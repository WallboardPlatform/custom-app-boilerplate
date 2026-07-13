import type { Accessor } from 'solid-js';

import { createLogger, MetadataProvider } from 'wallboard-app-sdk';
import type { ILoggerService } from 'wallboard-app-sdk';

import { getMetadata } from '@hooks/system/getMetadata';
import { useSettings } from '@hooks/system/useSettings';
import { useDataSources } from '@hooks/system/useDataSources';

import type { DataSources, Settings } from '@interfaces/application.interface';

interface IService {
  initialize(): void;
  destroy(): void;
}
/**
 * Error thrown when a lifecycle hook is not implemented but called.
 */
class LifecycleNotImplementedError extends Error {
  constructor(serviceName: string, methodName: string) {
    super(
      `Service '${serviceName}' must implement ${methodName}() lifecycle hook properly. This method cannot be called without an implementation.`
    );
    this.name = 'LifecycleNotImplementedError';
  }
}

/**
 * Abstract base class for application services
 * -
 * Provides common functionality including logging and lifecycle management.
 * All services should extend this class to ensure consistent behavior.
 */
export abstract class Service implements IService {
  protected readonly logger: ILoggerService;
  protected readonly metadata: MetadataProvider;
  protected readonly settings: Accessor<Settings>;
  protected readonly dataSources: Accessor<DataSources>;

  /**
   * Creates a new service instance
   * -
   * @param name - The name of the service, used for logging identification
   */
  constructor(private readonly name: string) {
    // Get Metadata Provider
    this.metadata = getMetadata();

    this.settings = useSettings();
    this.dataSources = useDataSources();

    // Create logger instance
    this.logger = createLogger(
      this.metadata,
      name
    );
  }

  /**
   * Initializes the service
   * -
   * Called to set up the service and log its initialization.
   * Override this method to add custom initialization logic.
   */
  initialize(): void {
    this.logger.initService();
  }

  /**
   * Destroys the service and cleans up resources
   * -
   * Called when the service is being torn down.
   * Override this method to add custom cleanup logic.
   */
  destroy(): void {
    this.logger.destroyService();
  }

  /**
   * Lifecycle hook called immediately after service registration
   * -
   * This method is automatically invoked when the service is registered in the dependency injection container.
   *
   * Use this hook to:
   * - Set up event listeners
   * - Subscribe to observables
   * - Initialize service-specific state
   * - Establish connections to external resources
   *
   * @Note This is called before the app is fully initialized.
   */
  onConstruct(): void {
    throw new LifecycleNotImplementedError(this.name, 'onConstruct');
  }

  /**
   * Lifecycle hook called before service destruction
   * -
   * This method is automatically invoked when the application is being destroyed or the service is being removed from the container.
   * Use this hook to:
   * - Unsubscribe from observables
   * - Remove event listeners
   * - Close connections
   * - Release resources
   * - Perform cleanup operations
   *
   * @Note This is called before the app fully cleaned up and service's destroy() method runs.
   */
  onDestruct(): void {
    throw new LifecycleNotImplementedError(this.name, 'onDestruct');
  }
}