import type { DaemonConfig } from './types.js';
import type { Logger } from './logger.js';

/**
 * Core daemon class — ties config + logger together with lifecycle management.
 * Registers SIGTERM/SIGINT handlers for clean shutdown.
 */
export class Daemon {
  private shuttingDown = false;
  private keepaliveTimer: ReturnType<typeof setInterval> | undefined;
  private readonly onSigterm: () => void;
  private readonly onSigint: () => void;

  constructor(
    private readonly config: DaemonConfig,
    private readonly logger: Logger,
  ) {
    this.onSigterm = () => void this.shutdown();
    this.onSigint = () => void this.shutdown();
  }

  /** Start the daemon: log startup info, register signal handlers, start keepalive. */
  async start(): Promise<void> {
    this.logger.info('daemon started', {
      log_level: this.config.log.level,
      scan_roots: this.config.projects.scan_roots.length,
      discord_configured: !!this.config.discord,
    });

    process.on('SIGTERM', this.onSigterm);
    process.on('SIGINT', this.onSigint);

    // Keep the event loop alive. The write stream alone doesn't hold a ref
    // when there's no pending I/O, so we need an explicit timer.
    this.keepaliveTimer = setInterval(() => {}, 60_000);
  }

  /** Idempotent shutdown: log, close logger, exit. */
  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    this.logger.info('daemon shutting down');

    // Remove signal handlers to avoid double-fire
    process.removeListener('SIGTERM', this.onSigterm);
    process.removeListener('SIGINT', this.onSigint);

    // Clear keepalive so the event loop can drain
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = undefined;
    }

    await this.logger.close();
    process.exit(0);
  }
}
