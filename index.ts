const offers = new Map<string, { sd: RTCSessionDescriptionInit, res: (value: Response | PromiseLike<Response>) => void, timer: Timer }>();

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type',
};
const badRequest = new Response("Bad Request", { status: 400, headers: CORS_HEADERS});
const notFound = new Response("Not Found", { status: 404, headers: CORS_HEADERS });
const requestTimeout = new Response("Request Timeout", { status: 408, headers: CORS_HEADERS });

Bun.serve({
    port: process.env.PORT,
    async fetch(req) {
        // Handle CORS preflight requests
        if (req.method === 'OPTIONS') {
            const res = new Response('Departed', { headers: CORS_HEADERS });
            return res;
        }
        
        const url = new URL(req.url);

        if (url.pathname === "/create-offer") {
            // console.log(url.pathname);
            if (req.method !== 'POST') return badRequest;

            const body = await req.json();
            if (!body.id || !body.sd) return badRequest;

            return new Promise<Response>((resolve) => {
                const timeout = setTimeout(() => {
                    offers.delete(body.id);
                    // console.log(offers);
                    resolve(requestTimeout);
                }, 60000);
                offers.set(body.id, { sd: body.sd, res: resolve, timer: timeout });
                // console.log(offers);
            });
        }

        if (url.pathname === "/get-offer") {
            // console.log(url.pathname);
            if (req.method !== 'GET') return badRequest;

            const id = url.searchParams.get('id');
            if (!id) return badRequest;

            const waitingOffer = offers.get(id);

            if (waitingOffer) return new Response(JSON.stringify(waitingOffer.sd), { headers: CORS_HEADERS });
            else return notFound;
        }

        if (url.pathname === "/create-answer") {
            // console.log(url.pathname);
            if (req.method !== 'POST') return badRequest;

            const body = await req.json();
            if (!body.id || !body.sd) return badRequest;

            const waitingOffer = offers.get(body.id);

            if (waitingOffer) {
                clearTimeout(waitingOffer.timer);
                waitingOffer.res(new Response(JSON.stringify(body.sd), { headers: CORS_HEADERS }));
                offers.delete(body.id);
                // console.log(offers);
                return new Response("Wait for connecting", { headers: CORS_HEADERS });
            }
            else return notFound;
        }

        return badRequest;
    }
});