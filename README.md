gh-dash-web

A web-based dashboard for GitHub pull requests and issues, inspired by [gh-dash](https://github.com/dlvhdr/gh-dash) by dlvhdr, a terminal UI for GitHub. This project reimagines that experience for the browser: fast, keyboard-driven, configurable sections backed by GitHub search queries.

Features
  
User-defined sections for pull requests and issues, each backed by a GitHub search query, just like gh-dash's YAML config, but editable live in the UI. Vim-style keyboard navigation: j and k to move, arrow keys or 1 through 9 to switch sections, o or Enter to open an item, r to refresh, and comma to open settings. Runs entirely client-side; your GitHub personal access token is stored only in your browser's localStorage and is sent only to api.github.com. Section configuration can be imported and exported as JSON.

Getting started

Open index.html in a browser, or serve the folder with any static file server. Click Settings and paste in a GitHub personal access token. A fine-grained token with read access to pull requests and issues is enough for public repos; classic tokens need the repo scope for private data. Then add sections using GitHub search syntax, such as: is:pr is:open author:@me, or is:pr is:open review-requested:@me, or is:issue is:open assignee:@me.
