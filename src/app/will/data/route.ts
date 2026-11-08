// Generate the Arrow payload at build time and serve it through static assets.
// Keeping coordinates out of the Worker avoids parsing 150k objects per isolate.
export function GET(request: Request) {
  return Response.redirect(new URL("/graph.arrow", request.url), 307);
}
