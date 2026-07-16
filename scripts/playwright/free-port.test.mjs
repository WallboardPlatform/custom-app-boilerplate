import assert from 'node:assert/strict';
import net from 'node:net';
import { test } from 'node:test';

import { findAvailablePort } from './free-port.mjs';

test('asks the operating system for an available preview port by default', async () => {
	const available = await findAvailablePort();

	assert.ok(available > 0 && available <= 65535);
});

test('skips a preview port already held by another process', async () => {
	const reserved = net.createServer();

	await new Promise((resolve, reject) => {
		reserved.once('error', reject);
		reserved.listen({ host: '127.0.0.1', port: 0 }, resolve);
	});

	try {
		const address = reserved.address();
		assert.notEqual(typeof address, 'string');
		assert.ok(address);

		const maxAttempts = Math.max(2, 65536 - address.port);
		const available = await findAvailablePort({ startPort: address.port, maxAttempts });

		assert.ok(available > address.port);
	} finally {
		await new Promise((resolve, reject) => reserved.close((error) => error ? reject(error) : resolve()));
	}
});
