# Bash completion for notion CLI
# Install: source notion.bash
# Or copy to /etc/bash_completion.d/notion

_notion_completions() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Top-level commands
    local commands="search page context config help"

    # Page subcommands
    local page_commands="get create"

    case "${COMP_WORDS[1]}" in
        search)
            case "$prev" in
                -f|--format)
                    COMPREPLY=( $(compgen -W "json markdown xml" -- "$cur") )
                    return 0
                    ;;
                -l|--limit)
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "-l --limit -f --format -p --pages -d --databases -h --help" -- "$cur") )
                    return 0
                    ;;
            esac
            ;;
        page)
            case "${COMP_WORDS[2]}" in
                get)
                    case "$prev" in
                        -f|--format)
                            COMPREPLY=( $(compgen -W "json markdown xml" -- "$cur") )
                            return 0
                            ;;
                        -D|--depth)
                            return 0
                            ;;
                        *)
                            COMPREPLY=( $(compgen -W "-f --format -D --depth -h --help" -- "$cur") )
                            return 0
                            ;;
                    esac
                    ;;
                create)
                    case "$prev" in
                        -p|--parent)
                            return 0
                            ;;
                        -f|--file)
                            COMPREPLY=( $(compgen -f -- "$cur") )
                            return 0
                            ;;
                        *)
                            COMPREPLY=( $(compgen -W "-p --parent -f --file --stdin -h --help" -- "$cur") )
                            return 0
                            ;;
                    esac
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "$page_commands" -- "$cur") )
                    return 0
                    ;;
            esac
            ;;
        context)
            case "$prev" in
                -f|--format)
                    COMPREPLY=( $(compgen -W "xml markdown" -- "$cur") )
                    return 0
                    ;;
                -t|--max-tokens)
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "-f --format -t --max-tokens -h --help" -- "$cur") )
                    return 0
                    ;;
            esac
            ;;
        config)
            case "$prev" in
                -t|--token)
                    return 0
                    ;;
                -p|--parent)
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "-t --token -p --parent -s --show -h --help" -- "$cur") )
                    return 0
                    ;;
            esac
            ;;
        *)
            if [[ ${cur} == -* ]]; then
                COMPREPLY=( $(compgen -W "-V --version -h --help" -- "$cur") )
            else
                COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
            fi
            return 0
            ;;
    esac
}

complete -F _notion_completions notion
