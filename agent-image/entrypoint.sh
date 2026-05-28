#!/bin/bash
set -e

if [ -n "$SKILL_REPOS" ]; then
    IFS=',' read -ra REPOS <<< "$SKILL_REPOS"
    for repo in "${REPOS[@]}"; do
        repo_name=$(basename "$repo" .git)
        echo "Cloning skill repo: $repo"
        git clone --depth 1 "$repo" "/workspace/skills/$repo_name" 2>/dev/null || echo "Warning: failed to clone $repo"
    done
fi

exec /usr/local/bin/sidecar
