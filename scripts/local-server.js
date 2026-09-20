import http from "node:http";
const handler = require("./dist/server/server.js").default;
const server = http.createServer(handler.fetch.bind(handler));
server.listen(process.env.PORT || 4000, () => console.log(`Listening on :${server.address().port}`));
