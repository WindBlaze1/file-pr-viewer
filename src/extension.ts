import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const provider = new PRViewProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'filePrViewer.view',
            provider
        )
    );

    vscode.window.onDidChangeActiveTextEditor(() => {
        provider.refresh();
    });
}

class PRViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;

    constructor(private context: vscode.ExtensionContext) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        this.refresh();
    }

    async refresh() {
        if (!this.view) {
            return;
        }

        const webview = this.view.webview;
        webview.html = loadingHtml();

        try {
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                webview.html = messageHtml("No active file");
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const repoPath = await this.getRepoRoot(filePath);

            if (!repoPath) {
                webview.html = messageHtml("Not inside a Git repository");
                return;
            }

            const git = simpleGit(repoPath);

            const shaRaw = await git.raw([
                'log',
                '--pretty=format:%H',
                '--',
                path.relative(repoPath, filePath),
            ]);

            const shaList = shaRaw
                .split('\n')
                .filter(Boolean)
                .slice(0, 25);

            if (!shaList.length) {
                webview.html = messageHtml("No commits found for this file");
                return;
            }

            const remoteResult = await git.remote(['get-url', 'origin']);
            const remoteUrl = String(remoteResult).trim();

            const { owner, repo } = parseGithubRemote(remoteUrl);

            // 🔐 VS Code GitHub Authentication
            const session = await vscode.authentication.getSession(
                'github',
                ['repo'],
                { createIfNone: true }
            );

            if (!session) {
                webview.html = messageHtml("GitHub authentication failed");
                return;
            }

            // ✅ Dynamic import (fixes ESM issue)
            const { Octokit } = await import('@octokit/rest');

            const octokit = new Octokit({
                auth: session.accessToken
            });

            // 🚀 Parallel API calls
            const prPromises = shaList.map(async (sha) => {
                try {
                    const res = await octokit.request(
                        'GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls',
                        {
                            owner,
                            repo,
                            commit_sha: sha,
                            mediaType: { previews: ['groot'] }
                        }
                    );

                    if (res.data.length > 0) {
                        return res.data[0];
                    }

                    return null;
                } catch {
                    return null;
                }
            });

            const results = await Promise.all(prPromises);
            const prs = results.filter(Boolean);

            const unique = Array.from(
                new Map(prs.map((p: any) => [p.number, p])).values()
            );

            unique.sort((a: any, b: any) => {
                const dateA = new Date(a.merged_at || a.updated_at).getTime();
                const dateB = new Date(b.merged_at || b.updated_at).getTime();
                return dateB - dateA;
            });

            webview.html = renderHtml(unique);

        } catch (err: any) {
            webview.html = messageHtml(`Error: ${err?.message || err}`);
        }
    }

    async getRepoRoot(filePath: string): Promise<string | null> {
        try {
            const git = simpleGit(path.dirname(filePath));
            const root = await git.revparse(['--show-toplevel']);
            return String(root).trim();
        } catch {
            return null;
        }
    }
}

function parseGithubRemote(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);

    if (!match) {
        throw new Error('Not a GitHub repository');
    }

    return {
        owner: match[1],
        repo: match[2]
    };
}

function loadingHtml(): string {
    return `
        <html>
        <body style="font-family: sans-serif; padding: 10px;">
            <p>Loading PRs...</p>
        </body>
        </html>
    `;
}

function messageHtml(message: string): string {
    return `
        <html>
        <body style="font-family: sans-serif; padding: 10px;">
            <p>${message}</p>
        </body>
        </html>
    `;
}

function renderHtml(prs: any[]): string {
    if (!prs || prs.length === 0) {
        return messageHtml("No PRs found for this file");
    }

    return `
        <html>
        <body style="font-family: sans-serif; padding: 10px;">
            <h3>PRs touching this file</h3>
            ${prs.map(pr => `
                <div style="margin-bottom: 14px;">
                    <a href="${pr.html_url}">
                        #${pr.number} - ${pr.title}
                    </a><br/>
                    <small>
                        ${pr.state.toUpperCase()} |
                        Author: ${pr.user?.login || 'Unknown'} |
                        Merged: ${pr.merged_at || 'Not merged'}
                    </small>
                </div>
            `).join('')}
        </body>
        </html>
    `;
}