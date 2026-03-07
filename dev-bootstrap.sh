#!/bin/bash

# This script is used to merge the environment variables from the env.example file and the env.*.example files into a single .env file and create symlinks for the environment variables in the apps and packages directories. The source of the environment variables is the .env file in the env package directory.
#
# Options:
#   -f    Run clean-envs.sh first to remove existing .env and .env.local files.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$SCRIPT_DIR/apps"
packages_dir="$SCRIPT_DIR/packages"

while getopts "f" opt; do
  case "$opt" in
    f)
      echo "Running clean-envs.sh..."
      "$SCRIPT_DIR/clean-envs.sh"
      ;;
    \?)
      echo "Usage: $0 [-f]" >&2
      echo "  -f  Run clean-envs.sh first (remove existing .env and .env.local)" >&2
      exit 1
      ;;
  esac
done
shift $((OPTIND - 1))

cd "$SCRIPT_DIR"

# Check if the .env file exists in the env package directory
if [[ ! -f "$packages_dir/env/.env" ]]; then
    echo "The .env file does not exist in $packages_dir/env/"
    "$packages_dir/env/merge-env-examples.sh" "$packages_dir/env/.env"
    echo "The .env file has been created in $packages_dir/env/"
    echo "Please edit the file and add the correct values."
    echo "Then run the script again."
fi

# Loop through the subdirectories of the app directory
for dir in "$app_dir"/*; do
    # Check if it is a directory
    if [[ -d "$dir" ]]; then
        # Create the symlink
        cd "$dir"
        echo `pwd`
        ln -s "../../packages/env/.env" ".env.local"
        ln -s "../../packages/env/.env" ".env"
        cd -
    fi
done

# Loop through the subdirectories of the apps/agents directory
for dir in "$app_dir/agents"/*; do
    # Check if it is a directory
    if [[ -d "$dir" ]]; then
        # Create the symlink
        cd "$dir"
        echo `pwd`
        ln -s "../../../packages/env/.env" ".env.local"
        ln -s "../../../packages/env/.env" ".env"
        cd -
    fi
done

# Loop through the subdirectories of the packages directory
for dir in "$packages_dir"/*; do
    # Check if it is a directory
    if [[ -d "$dir" ]]; then
        # Create the symlink
        cd "$dir"
        echo `pwd`
        ln -s "../../packages/env/.env" ".env.local"
        ln -s "../../packages/env/.env" ".env"
        cd -
    fi
done