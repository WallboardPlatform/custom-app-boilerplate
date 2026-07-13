# Services

Services in this project provide stateless business logic, utility functions, and data transformations.
They are singleton instances managed through tsyringe dependency injection.

## CRITICAL: Service Abstract Class Is Read-Only Infrastructure

The `src/services/service.abstract.ts` file is **foundational infrastructure** and must NEVER be:
- Modified
- Renamed
- Moved
- Deleted
- Duplicated

This abstract class is tightly coupled with the DI container and lifecycle management.
Any modification will break service initialization and cleanup across the application.

---

## When to Use Services

Services are the right choice when:
- You need **pure business logic** (calculations, validations, data transformations)
- You have **utility functions** (formatters, parsers, converters)
- Logic is **stateless** - input goes in, output comes out, no internal state
- Multiple components need the **same non-reactive logic**
- You need to **encapsulate domain knowledge** (e.g., "what counts as an upcoming meeting?")

## When NOT to Use Services

Do NOT put these in services:
- **Reactive state** - use `createSignal`, `createStore`, or contexts instead
- **RxJS Subjects/Observables** - the SDK and hooks handle reactivity
- **DOM manipulation** - keep this in components with refs
- **SDK event handling** - use `useExternalCommandListener()` hook
- **Component lifecycle logic** - use `onMount`, `onCleanup` in components
- **State that needs to trigger re-renders** - services are not reactive

---

## Service vs Hook vs Context vs Store

| Need                                            | Use                                        |  Why                               |
|-------------------------------------------------|--------------------------------------------|------------------------------------|
| Pure calculation/transformation                 | **Service**                                | Stateless, testable, reusable      |
| Reactive data from SDK                          | **Hook** (`useSettings`, `useDataSources`) | Already reactive                   |
| Shared reactive state across distant components | **Context**                                | Avoids prop drilling               |
| Local reactive state in component               | **Signal/Store**                           | SolidJS reactivity                 |
| Complex shared state with actions               | **Store + Service**                        | Store for state, service for logic |

### Decision Flow

```
Is it reactive state that should trigger re-renders?
  YES -> Use Signal, Store, or Context
  NO  -> Is it reusable logic needed by multiple components?
           YES -> Use Service
           NO  -> Keep it in the component
```

---

## Service Base Class

All services must extend the abstract `Service` class which provides:

**Built-in Properties:**
- `this.logger` - ILoggerService instance for consistent logging
- `this.metadata` - MetadataProvider for SDK integrations
- `this.settings()` - Accessor to current settings (reactive)
- `this.dataSources()` - Accessor to current data sources (reactive)

**Lifecycle Hooks:**
- `onConstruct()` - Called after DI registration (setup subscriptions, listeners)
- `onDestruct()` - Called before cleanup (unsubscribe, release resources)
- `initialize()` - Manual initialization (logs service init)
- `destroy()` - Manual cleanup (logs service destroy)

---

## Accessing Reactive Values in Services

Services are stateless, but they can **read** the current reactive values through the base class accessors.
This is a key pattern: the service does not store or manage reactive state, but uses the current values when methods are called.

**Available accessors:**
- `this.settings()` - Returns the current `Settings` object
- `this.dataSources()` - Returns the current `DataSources` object

### How It Works

When a component calls a service method, the service reads the **current** value of settings or data sources at that moment.
The service does not subscribe to changes - it simply uses whatever value is current when the method executes.

```typescript
@singleton()
export class MeetingRoomService extends Service {
  constructor() {
    super('MeetingRoomService');
  }

  public getAlmostStartedMeeting(): boolean {
    // Read current datasource value when method is called
    const datasourceValue: Meeting[] | undefined = this.getDatasourceValue();

    if (!datasourceValue) {
      return false;
    }

    const currentTime: Date = new Date();
    // Read current settings value - almostStartedMinutes comes from editor configuration
    const almostStartedTime: Date = new Date(
      currentTime.getTime() + this.settings().Room.almostStartedMinutes * 60000
    );

    return datasourceValue.some((event: Meeting): boolean => {
      const eventStartDate: Date = new Date(event.start.timeStamp);

      return eventStartDate >= currentTime && eventStartDate < almostStartedTime;
    });
  }

  private getDatasourceValue(): Meeting[] | undefined {
    // Access current datasource value
    const value: unknown = this.dataSources()?.myDataset?.value;

    if (!value || typeof value !== 'object' || !('events' in value)) {
      return undefined;
    }

    return value.events as Meeting[];
  }
}
```

### Important Distinction

| Aspect                      | Service Behavior                                     |
|-----------------------------|------------------------------------------------------|
| **Reads** reactive values   | Yes - via `this.settings()`, `this.dataSources()`    |
| **Stores** reactive state   | Yes - `BehaviorSubject`, No - `createSignal`         |
| **Triggers** re-renders     | No - components must call service methods reactively |
| **Subscribes** to changes   | No - just reads current value on each call           |

### Reactive Usage in Components

To make service results reactive, call service methods inside reactive contexts:

```typescript jsx
export default (): JSX.Element => {
  const meetingService: MeetingRoomService = useService<MeetingRoomService>(MeetingRoomService);
  const dataSources: Accessor<DataSources> = useDataSources();

  // This recalculates when dataSources changes
  const isAlmostStarted: Accessor<boolean> = createMemo((): boolean => {
    dataSources(); // Track dependency
    return meetingService.getAlmostStartedMeeting();
  });

  return <>
    <Show when={isAlmostStarted()}>
      <p>A meeting is about to start!</p>
    </Show>
  </>;
};
```

---

## Creating a Service
### IMPORTANT: Always add your services to `src/services.ts`

### Directory Structure

```
src/services
  service.abstract.ts    # Base class (DO NOT MODIFY)
  [feature].service.ts   # Your custom services
```

### Service Pattern

```typescript
// src/services/[feature].service.ts
import { singleton } from 'tsyringe';

import { Service } from '@services/service.abstract';

interface IFeatureService {
  calculateSomething(input: InputType): OutputType;
  formatData(data: RawData): FormattedData;
  validateInput(input: unknown): boolean;
}

@singleton()
export class FeatureService extends Service implements IFeatureService {
  constructor() {
    super('FeatureService');
  }

  public calculateSomething(input: InputType): OutputType {
    // Pure business logic - no side effects, no state mutation
    const result: OutputType = 1 + input /* any calculation */;

    return result;
  }

  public formatData(data: RawData): FormattedData {
    // Access settings if needed for formatting decisions
    const format: string = this.settings().dateFormat;

    return /* formatted result */;
  }

  public validateInput(input: unknown): boolean {
    // Validation logic
    if (!input || typeof input !== 'object') {
      return false;
    }

    return true;
  }

  // Optional: Override lifecycle hooks if needed
  onConstruct(): void {
    this.logger.initService();
    // Setup if needed (rarely necessary for stateless services)
  }

  onDestruct(): void {
    this.logger.destroyService();
    // Cleanup if needed
  }
}
```

### Registering the Service

Add your service to `src/services.ts`:

```typescript
import { FeatureService } from '@services/feature.service';

export const services: ServiceConstructor[] = [
  FeatureService,
  // ... other services
];
```

### Using the Service

```typescript jsx
import { useService } from '@hooks/useService';
import { FeatureService } from '@services/feature.service';

export default (): JSX.Element => {
  const featureService: FeatureService = useService<FeatureService>(FeatureService);

  const handleClick: () => void = (): void => {
    const result: OutputType = featureService.calculateSomething(inputData);
    // Use result...
  };

  return <>
    <button onClick={handleClick}>Calculate</button>
  </>;
};
```

---

## Good Service Examples

### Business Logic Service

```typescript
@singleton()
export class MeetingService extends Service {
  constructor() {
    super('MeetingService');
  }

  public getActualMeeting(meetings: Meeting[]): Meeting | undefined {
    const currentTime: Date = new Date();

    return meetings.find((meeting: Meeting): boolean => {
      const start: Date = new Date(meeting.start.timeStamp);
      const end: Date = new Date(meeting.end.timeStamp);

      return start <= currentTime && end > currentTime;
    });
  }

  public sortByStartTime(meetings: Meeting[]): Meeting[] {
    return [...meetings].sort((a: Meeting, b: Meeting): number => {
      return a.start.timeStamp - b.start.timeStamp;
    });
  }
}
```

### Utility Service

```typescript
@singleton()
export class FormatterService extends Service {
  constructor() {
    super('FormatterService');
  }

  public formatPrice(value: number): string {
    const currency: string = this.settings().currency;
    const decimals: number = this.settings().priceDecimals;

    return `${currency}${value.toFixed(decimals)}`;
  }

  public formatDate(timestamp: number): string {
    const format: string = this.settings().dateFormat;
    const date: Date = new Date(timestamp);

    // Format based on settings...
    return formattedDate;
  }

  public truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.substring(0, maxLength)}...`;
  }
}
```

---

## Anti-Patterns to Avoid

### DO NOT: Store signals as reactive state in services

```typescript
// BAD - services should not hold reactive state
@singleton()
export class BadService extends Service {
  private currentPage: number = 0;  // This won't trigger re-renders!

  setPage(page: number): void {
    this.currentPage = page;  // Components won't know this changed
  }
}

// GOOD - use a store or signal in component/context
const [currentPage, setCurrentPage] = createSignal<number>(0);
```

### DO NOT: Manipulate DOM in services

```typescript
// BAD - DOM manipulation belongs in components
@singleton()
export class BadService {
  highlightElement(element: HTMLElement): void {
    element.style.backgroundColor = 'yellow';
  }
}

```
```typescript jsx
// GOOD - handle in component with refs or CSS classes
<div class={isHighlighted() ? styles.highlighted : ''}>
```

---

## Key Principles

1. **Stateless:** Services should not hold mutable state that affects rendering
2. **Pure functions:** Methods should be deterministic - same input, same output
3. **Single responsibility:** Each service should focus on one domain area
4. **Extend Service:** Always extend the abstract `Service` class
5. **Use DI:** Access other services through constructor injection or `useService()`
6. **Leverage base class:** Use `this.settings()`, `this.dataSources()`, `this.logger`
7. **Interface first:** Define an interface for your service's public API
8. **Register properly:** Add to `src/services.ts` for automatic DI setup
