const offers = new Map<string, { sd: RTCSessionDescriptionInit, res: (value: Response | PromiseLike<Response>) => void, timer: Timer }>();

function applyCORSHeader(res: Response) {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return res;
}
function badRequest() {
    const response = new Response("Bad Request", { status: 400 });
    return applyCORSHeader(response);
}
function notFound() {
    const response = new Response("Not Found", { status: 404 });
    return applyCORSHeader(response);
}
function requestTimeout() {
    const response = new Response("Request Timeout", { status: 408 });
    return applyCORSHeader(response);
}

Bun.serve({
    port: process.env.PORT,
    async fetch(req) {
        // Handle CORS preflight requests
        if (req.method === 'OPTIONS') {
            const response = new Response('Departed');
            return applyCORSHeader(response);
        }

        const url = new URL(req.url);

        if (url.pathname === "/create-offer") {
            if (req.method !== 'POST') return badRequest();

            const body = await req.json();
            if (!body.id || !body.sd) return badRequest();
            if (offers.has(body.id)) {
                const respose = new Response("ID Already Exists", { status: 202 });
                return applyCORSHeader(respose);
            }

            return new Promise<Response>((resolve) => {
                const timeout = setTimeout(() => {
                    offers.delete(body.id);
                    const timeoutRes = requestTimeout();
                    resolve(timeoutRes);
                }, 30000);
                offers.set(body.id, { sd: body.sd, res: resolve, timer: timeout });
            });
        }

        if (url.pathname === "/get-offer") {
            if (req.method !== 'GET') return badRequest();

            const id = url.searchParams.get('id');
            if (!id) return badRequest();

            const waitingOffer = offers.get(id);

            if (waitingOffer) {
                const response = new Response(JSON.stringify(waitingOffer.sd));
                return applyCORSHeader(response);
            }
            else return notFound();
        }

        if (url.pathname === "/create-answer") {
            if (req.method !== 'POST') return badRequest();

            const body = await req.json();
            if (!body.id || !body.sd) return badRequest();

            const waitingOffer = offers.get(body.id);

            if (waitingOffer) {
                clearTimeout(waitingOffer.timer);
                const resOffer = new Response(JSON.stringify(body.sd));
                waitingOffer.res(applyCORSHeader(resOffer));
                offers.delete(body.id);
                const response = new Response("Wait for connecting");
                return applyCORSHeader(response);
            }
            else return notFound();
        }

        return badRequest();
    }
});