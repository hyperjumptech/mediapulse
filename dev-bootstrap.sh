#!/bin/bash

# This script is used to create symlinks for the environment variables in the apps and packages directories. The source of the environment variables is the .env file in the env package directory.

# Define the directories
app_dir="./apps"
packages_dir="./packages"

# Check if the .env file exists in the `env`` package directory
if [[ ! -f "$packages_dir/env/.env" ]]; then
    echo "The .env file does not exist in $packages_dir/env/"
    cp "$packages_dir/env/env.example" "$packages_dir/env/.env"
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
        ln -s "../../$packages_dir/env/.env" ".env.local"
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
        ln -s "../../$packages_dir/env/.env" ".env.local"
        ln -s "../../$packages_dir/env/.env" ".env"
        cd -
    fi
done