# file-pr-viewer

A VS Code extension that lists GitHub pull requests that touched the currently active file. View them in a panel and open links directly to GitHub.

## Features

- **Panel view**: Shows a "File PR Viewer" panel in the bottom panel area
- **Auto-refresh**: Updates when you switch to a different file
- **GitHub auth**: Uses VS Code's built-in GitHub sign-in (no token setup required)
- **PR links**: Click any PR to open it on GitHub
- **PR details**: Shows number, title, state, author, and merge date

## Requirements

- VS Code 1.109.0 or later
- Git repository with a GitHub remote (`origin`)
- GitHub account (for authentication)

## How to use

1. Open a file in a Git repo that has `origin` pointing to GitHub
2. Open the panel (View > Output, or use the panel tab bar) and select **"File PR Viewer"** / **"PRs for File"**
3. Sign in to GitHub when prompted (first use)
4. PRs that modified the current file appear in the list
5. Click a PR to open it in your browser

## Extension Settings

This extension does not add any configurable settings.

## Known Issues

- Only works with GitHub remotes. GitLab, Bitbucket, etc. are not supported.
- PR detection is limited to the last 25 commits for the file (performance).
- Requires the commit to be associated with a PR via GitHub's API (e.g. squash merges may not always link correctly).

## Release Notes

### 0.0.1

Initial release. Shows GitHub PRs that touched the active file in a panel view.
