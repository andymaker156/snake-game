# Snake Game

A minimal Express-hosted Snake game with a browser-based UI and local score tracking.

## New features added

- **Game history panel**: shows the last 5 completed games.
- **Persistent stats**: tracks total games played, wins, and average score locally in `localStorage`.
- **Improved snake visibility**: stronger snake body/head/tail colors and borders make growth easier to see.
- **Score history persistence**: game results survive page reloads.

## Project structure

- `app.js` - Express server that serves the game from `public/`.
- `public/index.html` - game UI shell and controls.
- `public/snake-logic.js` - core Snake game engine and movement logic.
- `public/snake-game.js` - browser UI controller, rendering, and persistent state handling.
- `public/snake.css` - game styling and theme support.
- `scripts/test-mcp.ps1` - helper script to call configured MCP servers.
- `.vscode/mcp.json` - workspace MCP server configuration.

## Run locally

```bash
npm install
npm start
```

Then open:

```
http://localhost:3001
```

> Note: the app is currently running on port `3001` because port `3000` was already in use.

## MCP configuration

The workspace MCP config is defined in `.vscode/mcp.json` with servers:
- `ct-devmcp`
- `context7`
- `vexmcp`

This config is used for tool integration and MCP-based commands outside the game runtime.
