const std = @import("std");
const json = std.json;

const OutputFormat = enum {
    xml,
    md,
};

const Args = struct {
    format: OutputFormat = .xml,
    max_depth: ?u32 = null,
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Parse command line arguments
    const args = try parseArgs();

    // Read JSON from stdin using new Zig 0.15 API
    var stdin_buf: [4096]u8 = undefined;
    var stdin = std.fs.File.stdin().readerStreaming(&stdin_buf);

    // Collect all input into a dynamic array (using unmanaged version for 0.15)
    var input_list: std.ArrayListUnmanaged(u8) = .empty;
    defer input_list.deinit(allocator);

    var read_buf: [4096]u8 = undefined;
    while (true) {
        const bytes_read = stdin.interface.read(&read_buf) catch |err| {
            if (err == error.EndOfStream) break;
            return err;
        };
        if (bytes_read == 0) break;
        try input_list.appendSlice(allocator, read_buf[0..bytes_read]);
    }

    const input = input_list.items;

    // Parse JSON
    const parsed = try json.parseFromSlice(json.Value, allocator, input, .{});
    defer parsed.deinit();

    // Write output to stdout using new Zig 0.15 API
    var stdout_buf: [4096]u8 = undefined;
    var stdout = std.fs.File.stdout().writerStreaming(&stdout_buf);
    defer stdout.interface.flush() catch {};

    switch (args.format) {
        .xml => try writeXml(&stdout.interface, parsed.value),
        .md => try writeMarkdown(&stdout.interface, parsed.value),
    }
}

fn parseArgs() !Args {
    var args = Args{};
    var arg_iter = std.process.args();
    _ = arg_iter.skip(); // Skip program name

    while (arg_iter.next()) |arg| {
        if (std.mem.eql(u8, arg, "--format")) {
            if (arg_iter.next()) |format_arg| {
                if (std.mem.eql(u8, format_arg, "xml")) {
                    args.format = .xml;
                } else if (std.mem.eql(u8, format_arg, "md")) {
                    args.format = .md;
                }
            }
        } else if (std.mem.eql(u8, arg, "--max-depth")) {
            if (arg_iter.next()) |depth_arg| {
                args.max_depth = std.fmt.parseInt(u32, depth_arg, 10) catch null;
            }
        }
    }

    return args;
}

fn writeXml(writer: anytype, root: json.Value) !void {
    // Write XML header
    try writer.writeAll("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");

    // Get page data
    const obj = root.object;

    const id = getStringField(obj, "id") orelse "unknown";
    const title = getStringField(obj, "title") orelse "Untitled";
    const last_edited = getStringField(obj, "lastEdited") orelse "";

    // Extract date part from ISO string
    var edited_date: []const u8 = last_edited;
    if (std.mem.indexOf(u8, last_edited, "T")) |t_index| {
        edited_date = last_edited[0..t_index];
    }

    // Write page element
    try writer.print("<notion_page id=\"{s}\" title=\"", .{id});
    try writeEscapedXml(writer, title);
    try writer.print("\" edited=\"{s}\">\n", .{edited_date});

    // Write properties
    if (obj.get("properties")) |props_value| {
        if (props_value == .object) {
            const props = props_value.object;
            if (props.count() > 0) {
                try writer.writeAll("  <props");
                var iter = props.iterator();
                while (iter.next()) |entry| {
                    const key = entry.key_ptr.*;
                    const val = entry.value_ptr.*;
                    if (val == .string) {
                        try writer.print(" {s}=\"", .{key});
                        try writeEscapedXml(writer, val.string);
                        try writer.writeAll("\"");
                    } else if (val == .bool) {
                        try writer.print(" {s}=\"{s}\"", .{ key, if (val.bool) "true" else "false" });
                    } else if (val == .integer) {
                        try writer.print(" {s}=\"{d}\"", .{ key, val.integer });
                    } else if (val == .float) {
                        try writer.print(" {s}=\"{d}\"", .{ key, val.float });
                    }
                }
                try writer.writeAll(" />\n");
            }
        }
    }

    // Write content
    try writer.writeAll("  <content>\n");

    if (obj.get("blocks")) |blocks_value| {
        if (blocks_value == .array) {
            for (blocks_value.array.items) |block| {
                try writeBlockXml(writer, block, 4);
            }
        }
    }

    try writer.writeAll("  </content>\n");
    try writer.writeAll("</notion_page>\n");
}

fn writeBlockXml(writer: anytype, block: json.Value, indent: usize) !void {
    if (block != .object) return;

    const obj = block.object;
    const block_type = getStringField(obj, "type") orelse "unknown";
    const content = getStringField(obj, "content") orelse "";

    // Map block types to XML tags
    const tag = mapBlockTypeToTag(block_type);

    // Write indentation
    try writer.writeByteNTimes(' ', indent);

    // Handle empty content
    if (content.len == 0) {
        if (std.mem.eql(u8, block_type, "divider")) {
            try writer.print("<{s} />\n", .{tag});
            return;
        }
    }

    // Check for children
    const has_children = if (obj.get("children")) |children| children == .array and children.array.items.len > 0 else false;

    if (has_children) {
        try writer.print("<{s}>", .{tag});
        try writeEscapedXml(writer, content);
        try writer.writeAll("\n");

        if (obj.get("children")) |children| {
            if (children == .array) {
                for (children.array.items) |child| {
                    try writeBlockXml(writer, child, indent + 2);
                }
            }
        }

        try writer.writeByteNTimes(' ', indent);
        try writer.print("</{s}>\n", .{tag});
    } else {
        // Handle code blocks with language attribute
        if (std.mem.eql(u8, block_type, "code")) {
            try writer.print("<{s} lang=\"plain\">", .{tag});
        } else {
            try writer.print("<{s}>", .{tag});
        }
        try writeEscapedXml(writer, content);
        try writer.print("</{s}>\n", .{tag});
    }
}

fn mapBlockTypeToTag(block_type: []const u8) []const u8 {
    const mappings = .{
        .{ "heading_1", "h1" },
        .{ "heading_2", "h2" },
        .{ "heading_3", "h3" },
        .{ "paragraph", "p" },
        .{ "bulleted_list_item", "li" },
        .{ "numbered_list_item", "li" },
        .{ "to_do", "todo" },
        .{ "toggle", "toggle" },
        .{ "quote", "blockquote" },
        .{ "divider", "hr" },
        .{ "callout", "callout" },
        .{ "code", "code" },
        .{ "image", "img" },
        .{ "video", "video" },
        .{ "file", "file" },
        .{ "pdf", "pdf" },
        .{ "bookmark", "bookmark" },
        .{ "equation", "equation" },
        .{ "table_of_contents", "toc" },
        .{ "breadcrumb", "breadcrumb" },
        .{ "column_list", "columns" },
        .{ "column", "column" },
        .{ "synced_block", "synced" },
        .{ "template", "template" },
        .{ "link_preview", "link" },
        .{ "link_to_page", "pageref" },
        .{ "table", "table" },
        .{ "table_row", "tr" },
    };

    inline for (mappings) |mapping| {
        if (std.mem.eql(u8, block_type, mapping[0])) {
            return mapping[1];
        }
    }

    return block_type;
}

fn writeEscapedXml(writer: anytype, str: []const u8) !void {
    for (str) |c| {
        switch (c) {
            '&' => try writer.writeAll("&amp;"),
            '<' => try writer.writeAll("&lt;"),
            '>' => try writer.writeAll("&gt;"),
            '"' => try writer.writeAll("&quot;"),
            '\'' => try writer.writeAll("&apos;"),
            else => try writer.writeByte(c),
        }
    }
}

fn writeMarkdown(writer: anytype, root: json.Value) !void {
    if (root != .object) return;

    const obj = root.object;
    const title = getStringField(obj, "title") orelse "Untitled";

    // Write title
    try writer.print("# {s}\n\n", .{title});

    // Write blocks
    if (obj.get("blocks")) |blocks_value| {
        if (blocks_value == .array) {
            for (blocks_value.array.items) |block| {
                try writeBlockMarkdown(writer, block, 0);
            }
        }
    }
}

fn writeBlockMarkdown(writer: anytype, block: json.Value, indent: usize) !void {
    if (block != .object) return;

    const obj = block.object;
    const block_type = getStringField(obj, "type") orelse "unknown";
    const content = getStringField(obj, "content") orelse "";

    // Write indentation for nested items
    if (indent > 0) {
        try writer.writeByteNTimes(' ', indent * 2);
    }

    // Convert block type to markdown
    if (std.mem.eql(u8, block_type, "heading_1")) {
        try writer.print("# {s}\n\n", .{content});
    } else if (std.mem.eql(u8, block_type, "heading_2")) {
        try writer.print("## {s}\n\n", .{content});
    } else if (std.mem.eql(u8, block_type, "heading_3")) {
        try writer.print("### {s}\n\n", .{content});
    } else if (std.mem.eql(u8, block_type, "paragraph")) {
        if (content.len > 0) {
            try writer.print("{s}\n\n", .{content});
        }
    } else if (std.mem.eql(u8, block_type, "bulleted_list_item")) {
        try writer.print("- {s}\n", .{content});
    } else if (std.mem.eql(u8, block_type, "numbered_list_item")) {
        try writer.print("1. {s}\n", .{content});
    } else if (std.mem.eql(u8, block_type, "to_do")) {
        try writer.print("- [ ] {s}\n", .{content});
    } else if (std.mem.eql(u8, block_type, "quote")) {
        try writer.print("> {s}\n\n", .{content});
    } else if (std.mem.eql(u8, block_type, "code")) {
        try writer.writeAll("```\n");
        try writer.print("{s}\n", .{content});
        try writer.writeAll("```\n\n");
    } else if (std.mem.eql(u8, block_type, "divider")) {
        try writer.writeAll("---\n\n");
    } else if (std.mem.eql(u8, block_type, "toggle")) {
        try writer.print("<details>\n<summary>{s}</summary>\n\n", .{content});
    } else {
        // Default: just write content as paragraph
        if (content.len > 0) {
            try writer.print("{s}\n\n", .{content});
        }
    }

    // Handle children
    if (obj.get("children")) |children| {
        if (children == .array) {
            for (children.array.items) |child| {
                try writeBlockMarkdown(writer, child, indent + 1);
            }
        }
    }

    // Close toggle
    if (std.mem.eql(u8, block_type, "toggle")) {
        try writer.writeAll("</details>\n\n");
    }
}

fn getStringField(obj: json.ObjectMap, key: []const u8) ?[]const u8 {
    if (obj.get(key)) |value| {
        if (value == .string) {
            return value.string;
        }
    }
    return null;
}

// Tests
test "escape xml special characters" {
    var output: std.ArrayListUnmanaged(u8) = .empty;
    defer output.deinit(std.testing.allocator);

    try writeEscapedXml(output.writer(std.testing.allocator), "Hello <world> & \"friends\"");

    try std.testing.expectEqualStrings("Hello &lt;world&gt; &amp; &quot;friends&quot;", output.items);
}

test "map block types to tags" {
    try std.testing.expectEqualStrings("h1", mapBlockTypeToTag("heading_1"));
    try std.testing.expectEqualStrings("p", mapBlockTypeToTag("paragraph"));
    try std.testing.expectEqualStrings("li", mapBlockTypeToTag("bulleted_list_item"));
    try std.testing.expectEqualStrings("code", mapBlockTypeToTag("code"));
    try std.testing.expectEqualStrings("unknown_type", mapBlockTypeToTag("unknown_type"));
}
