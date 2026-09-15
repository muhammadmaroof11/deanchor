/**
 * Deterministic Finite State Machine (FSM) with Context Reducer
 * Origin: statelyai/xstate
 * Explicit state-transition table with event-driven actions and immutable context.
 */

export interface EventObject {
  type: string;
  [key: string]: any;
}

export type ActionFunction<TContext, TEvent extends EventObject> = (
  context: TContext,
  event: TEvent
) => Partial<TContext> | void;

export interface StateConfig<TContext, TEvent extends EventObject> {
  on?: Record<string, string | { target: string; actions?: ActionFunction<TContext, TEvent>[] }>;
  entry?: ActionFunction<TContext, TEvent>[];
  exit?: ActionFunction<TContext, TEvent>[];
}

export interface MachineConfig<TContext, TEvent extends EventObject> {
  id: string;
  initial: string;
  context: TContext;
  states: Record<string, StateConfig<TContext, TEvent>>;
}

export class StateMachine<TContext, TEvent extends EventObject> {
  readonly id: string;
  readonly initialState: string;
  private current: string;
  private context: TContext;
  private states: Record<string, StateConfig<TContext, TEvent>>;

  constructor(config: MachineConfig<TContext, TEvent>) {
    this.id = config.id;
    this.initialState = config.initial;
    this.current = config.initial;
    this.context = Object.assign({}, config.context);
    this.states = config.states;

    if (!this.states[this.current]) {
      throw new Error(`Initial state '${this.current}' does not exist in machine '${this.id}'`);
    }
  }

  get state(): string {
    return this.current;
  }

  getContext(): Readonly<TContext> {
    return Object.freeze({ ...this.context });
  }

  transition(event: TEvent): { state: string; context: Readonly<TContext>; changed: boolean } {
    const currentStateConfig = this.states[this.current];
    if (!currentStateConfig || !currentStateConfig.on) {
      return { state: this.current, context: this.getContext(), changed: false };
    }

    const transitionTarget = currentStateConfig.on[event.type];
    if (!transitionTarget) {
      return { state: this.current, context: this.getContext(), changed: false };
    }

    const targetState = typeof transitionTarget === "string" ? transitionTarget : transitionTarget.target;
    const actions = typeof transitionTarget === "object" ? transitionTarget.actions || [] : [];

    if (!this.states[targetState]) {
      throw new Error(`Target state '${targetState}' not defined in state machine`);
    }

    // Run exit actions of current state
    if (currentStateConfig.exit) {
      for (const fn of currentStateConfig.exit) {
        const update = fn(this.context, event);
        if (update) Object.assign(this.context, update);
      }
    }

    // Run transition actions
    for (const fn of actions) {
      const update = fn(this.context, event);
      if (update) Object.assign(this.context, update);
    }

    // Run entry actions of next state
    const nextStateConfig = this.states[targetState];
    if (nextStateConfig && nextStateConfig.entry) {
      for (const fn of nextStateConfig.entry) {
        const update = fn(this.context, event);
        if (update) Object.assign(this.context, update);
      }
    }

    this.current = targetState;
    return { state: this.current, context: this.getContext(), changed: true };
  }
}
