/** Local host simulator. Keep the four action literals aligned with CustomWidgetAPI. */
export interface PreviewAudioConfig {
	supported: boolean;
	instanceId?: string;
	globallyMuted: boolean;
	muted: boolean;
	duckState: { isDucked: boolean; duckingLevel: number; fadeDurationMS: number };
}

export interface PreviewAudioFixture {
	supported?: boolean;
	globallyMuted?: boolean;
	muted?: boolean;
	otherSourceActive?: boolean;
	ducking?: { enabled: boolean; duckingLevel: number; fadeDurationMS: number };
}

export interface PreviewAudioParameters {
	instanceId: string;
	sourceKey: string;
	element?: HTMLMediaElement;
	isPlaying?: boolean;
}

interface Source {
	element?: HTMLMediaElement;
	playing: boolean;
	audible: boolean;
	originalMuted?: boolean;
	removeListeners?: () => void;
}

interface Session {
	instanceId: string;
	fixture: PreviewAudioFixture;
	sources: Map<string, Source>;
	notify: (event: { messageType: 'audioDuckState'; audio: PreviewAudioConfig }) => void;
	lastMessage?: string;
}

let nextRender = 0;

export class PreviewAudioHost {
	public readonly calls: Array<{ action: string; params: PreviewAudioParameters; accepted: boolean }> = [];
	private readonly sessions = new Map<string, Session>();
	private readonly owners = new Map<HTMLMediaElement, Source>();

	public beginRender(fixture: PreviewAudioFixture, notify: Session['notify']): PreviewAudioConfig {
		const instanceId = `preview-audio-${++nextRender}`;
		const session: Session = { instanceId, fixture: { ...fixture }, sources: new Map(), notify };
		this.sessions.set(instanceId, session);
		return this.getConfig(session);
	}

	public update(instanceId: string, patch: PreviewAudioFixture): void {
		const session = this.sessions.get(instanceId);
		if (!session) return;
		// Support is a render capability. Changing it requires a new render/token.
		session.fixture = { ...session.fixture, ...patch, supported: session.fixture.supported };
		for (const source of session.sources.values()) this.sync(session, source);
		this.publish();
	}

	public endRender(instanceId: string): void {
		const session = this.sessions.get(instanceId);
		if (!session) return;
		this.sessions.delete(instanceId);
		for (const key of Array.from(session.sources.keys())) {
			session.sources.get(key)?.element?.pause();
			this.release(session, key);
		}
		this.publish();
	}

	public handle(action: string, params: PreviewAudioParameters): boolean {
		const accepted = this.apply(action, params);
		this.calls.push({ action, params: { ...params }, accepted });
		return accepted;
	}

	private apply(action: string, params: PreviewAudioParameters): boolean {
		const session = this.sessions.get(params?.instanceId);
		if (!session || session.fixture.supported !== true || typeof params.sourceKey !== 'string' || !params.sourceKey)
			return false;
		const existing = session.sources.get(params.sourceKey);
		switch (action) {
			case 'registerElement':
			case 'registerSource': {
				const element = action === 'registerElement' ? params.element : undefined;
				if (
					action === 'registerElement' &&
					(!element || !['AUDIO', 'VIDEO'].includes(element.tagName) || typeof element.addEventListener !== 'function')
				)
					return false;
				if (existing) return existing.element === element;
				if (element && this.owners.has(element)) return false;
				const source: Source = { element, playing: false, audible: false };
				session.sources.set(params.sourceKey, source);
				if (element) {
					this.owners.set(element, source);
					const events = ['play', 'playing', 'pause', 'ended', 'volumechange'];
					const stopEvents = ['emptied', 'error'];
					const update = (): void => {
						this.sync(session, source);
						this.publish();
					};
					const stop = (): void => {
						source.audible = false;
						this.publish();
					};
					events.forEach((event): void => element.addEventListener(event, update));
					stopEvents.forEach((event): void => element.addEventListener(event, stop));
					source.removeListeners = (): void => {
						events.forEach((event): void => element.removeEventListener(event, update));
						stopEvents.forEach((event): void => element.removeEventListener(event, stop));
					};
				}
				this.sync(session, source);
				break;
			}
			case 'setPlaying':
				if (!existing || existing.element || typeof params.isPlaying !== 'boolean') return false;
				existing.playing = params.isPlaying;
				this.sync(session, existing);
				break;
			case 'release':
				this.release(session, params.sourceKey);
				break;
			default:
				return false;
		}
		this.publish();
		return true;
	}

	private isMuted(session: Session): boolean {
		return session.fixture.globallyMuted === true || session.fixture.muted === true;
	}

	private sync(session: Session, source: Source): void {
		const muted = this.isMuted(session);
		const element = source.element;
		if (element) {
			if (muted) {
				if (source.originalMuted === undefined) source.originalMuted = element.muted;
				if (!element.muted) element.muted = true;
			} else if (source.originalMuted !== undefined) {
				element.muted = source.originalMuted;
				source.originalMuted = undefined;
			}
			source.audible =
				!muted && !element.muted && element.volume > 0 && !element.paused && !element.ended && !element.error;
		} else {
			source.audible = source.playing && !muted;
		}
	}

	private release(session: Session, key: string): void {
		const source = session.sources.get(key);
		if (!source) return;
		session.sources.delete(key);
		source.removeListeners?.();
		if (source.element) {
			this.owners.delete(source.element);
			if (source.originalMuted !== undefined) {
				source.element.pause();
				source.element.muted = source.originalMuted;
			}
		}
	}

	private getConfig(session: Session): PreviewAudioConfig {
		const ducking = session.fixture.ducking;
		const otherActive =
			session.fixture.otherSourceActive === true ||
			Array.from(this.sessions.values()).some(
				(other): boolean =>
					other !== session && Array.from(other.sources.values()).some((source): boolean => source.audible)
			);
		return {
			supported: session.fixture.supported === true,
			instanceId: session.instanceId,
			globallyMuted: session.fixture.globallyMuted === true,
			muted: this.isMuted(session),
			duckState:
				session.fixture.supported === true && ducking
					? {
							isDucked: ducking.enabled && otherActive,
							duckingLevel: ducking.duckingLevel,
							fadeDurationMS: ducking.fadeDurationMS
						}
					: { isDucked: false, duckingLevel: 100, fadeDurationMS: 0 }
		};
	}

	private publish(): void {
		for (const session of this.sessions.values()) {
			const audio = this.getConfig(session);
			const message = JSON.stringify(audio);
			if (message !== session.lastMessage) {
				session.lastMessage = message;
				session.notify({ messageType: 'audioDuckState', audio });
			}
		}
	}
}
