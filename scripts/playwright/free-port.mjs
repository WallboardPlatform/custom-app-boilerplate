import net from 'node:net';

const canListen = (port) => new Promise((resolve, reject) => {
	const server = net.createServer();

	server.unref();
	server.once('error', (error) => {
		if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
			resolve(false);
			return;
		}

		reject(error);
	});
	server.listen({ host: '127.0.0.1', port }, () => {
		server.close((error) => error ? reject(error) : resolve(true));
	});
});

const requestEphemeralPort = () => new Promise((resolve, reject) => {
	const server = net.createServer();

	server.unref();
	server.once('error', reject);
	server.listen({ host: '127.0.0.1', port: 0 }, () => {
		const address = server.address();

		if (!address || typeof address === 'string') {
			server.close();
			reject(new Error('Operating system did not allocate a TCP preview port.'));
			return;
		}

		server.close((error) => error ? reject(error) : resolve(address.port));
	});
});

export const findAvailablePort = async ({
	startPort,
	maxAttempts = 200
} = {}) => {
	if (startPort === undefined) {
		return requestEphemeralPort();
	}

	for (let offset = 0; offset < maxAttempts; offset += 1) {
		const candidate = startPort + offset;

		if (candidate > 65535) {
			break;
		}

		if (await canListen(candidate)) {
			return candidate;
		}
	}

	throw new Error(`No available preview port found from ${startPort} after ${maxAttempts} attempts.`);
};
