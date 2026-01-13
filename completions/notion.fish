# Fish completion for notion CLI
# Install: copy to ~/.config/fish/completions/notion.fish

# Disable file completions by default
complete -c notion -f

# Global options
complete -c notion -s V -l version -d 'Show version'
complete -c notion -s h -l help -d 'Show help'

# Commands
complete -c notion -n '__fish_use_subcommand' -a search -d 'Search pages and databases'
complete -c notion -n '__fish_use_subcommand' -a page -d 'Page operations'
complete -c notion -n '__fish_use_subcommand' -a context -d 'Extract page content for AI'
complete -c notion -n '__fish_use_subcommand' -a config -d 'Manage configuration'
complete -c notion -n '__fish_use_subcommand' -a help -d 'Show help'

# Search command options
complete -c notion -n '__fish_seen_subcommand_from search' -s l -l limit -d 'Maximum results'
complete -c notion -n '__fish_seen_subcommand_from search' -s f -l format -a 'json markdown xml' -d 'Output format'
complete -c notion -n '__fish_seen_subcommand_from search' -s p -l pages -d 'Filter to pages only'
complete -c notion -n '__fish_seen_subcommand_from search' -s d -l databases -d 'Filter to databases only'
complete -c notion -n '__fish_seen_subcommand_from search' -s h -l help -d 'Show help'

# Page subcommands
complete -c notion -n '__fish_seen_subcommand_from page; and not __fish_seen_subcommand_from get create' -a get -d 'Retrieve page content'
complete -c notion -n '__fish_seen_subcommand_from page; and not __fish_seen_subcommand_from get create' -a create -d 'Create a new page'

# Page get options
complete -c notion -n '__fish_seen_subcommand_from page; and __fish_seen_subcommand_from get' -s f -l format -a 'json markdown xml' -d 'Output format'
complete -c notion -n '__fish_seen_subcommand_from page; and __fish_seen_subcommand_from get' -s D -l depth -d 'Block recursion depth'
complete -c notion -n '__fish_seen_subcommand_from page; and __fish_seen_subcommand_from get' -s h -l help -d 'Show help'

# Page create options
complete -c notion -n '__fish_seen_subcommand_from page; and __fish_seen_subcommand_from create' -s p -l parent -d 'Parent page ID'
complete -c notion -n '__fish_seen_subcommand_from page; and __fish_seen_subcommand_from create' -s f -l file -r -d 'Read from file'
complete -c notion -n '__fish_seen_subcommand_from page; and __fish_seen_subcommand_from create' -l stdin -d 'Read from stdin'
complete -c notion -n '__fish_seen_subcommand_from page; and __fish_seen_subcommand_from create' -s h -l help -d 'Show help'

# Context command options
complete -c notion -n '__fish_seen_subcommand_from context' -s f -l format -a 'xml markdown' -d 'Output format'
complete -c notion -n '__fish_seen_subcommand_from context' -s t -l max-tokens -d 'Token limit'
complete -c notion -n '__fish_seen_subcommand_from context' -s h -l help -d 'Show help'

# Config command options
complete -c notion -n '__fish_seen_subcommand_from config' -s t -l token -d 'Set API token'
complete -c notion -n '__fish_seen_subcommand_from config' -s p -l parent -d 'Set default parent'
complete -c notion -n '__fish_seen_subcommand_from config' -s s -l show -d 'Show current config'
complete -c notion -n '__fish_seen_subcommand_from config' -s h -l help -d 'Show help'
