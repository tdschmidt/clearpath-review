import { createApp } from './app.ts';

const app = createApp();
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`ClearPath Review listening on http://localhost:${port}`));
function shutdown() { server.close(() => { app.locals.store.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
