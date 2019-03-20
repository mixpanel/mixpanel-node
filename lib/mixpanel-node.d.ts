declare const mixpanel: mixpanel.Mixpanel;

declare namespace mixpanel {
  export type Callback = (err: Error | undefined) => any;
  export type BatchCallback = (errors: [Error] | undefined) => any;

  type Scalar = string | number | boolean;

  export interface InitConfig {
    [key: string]: any;
  }

  export interface PropertyDict {
    [key: string]: any;
  }

  export interface NumberMap {
    [key: string]: number;
  }

  export interface Event {
    event: string;
    properties: PropertyDict;
  }
  export interface Modifiers {
    $ip?: string;
    $ignore_time?: boolean;
    $time?: string;
    $ignore_alias?: boolean;
  }

  export interface BatchOptions {
    max_concurrent_requests?: number;
    max_batch_size?: number;
  }

  export interface UnionData {
    [key: string]: Scalar | Scalar[];
  }

  interface Mixpanel {
    init(mixpanelToken: string, config?: InitConfig): Mixpanel;

    track(eventName: string, callback?: Callback): void;
    track(eventName: string, properties: PropertyDict, callback?: Callback): void;

    track_batch(events: Event[], options?: BatchOptions, callback?: BatchCallback): void;
    track_batch(events: Event[], callback: BatchCallback): void;
    track_batch(eventNames: string[], options?: BatchOptions, callback?: BatchCallback): void;
    track_batch(eventNames: string[], callback?: BatchCallback): void;

    import(eventName: string, time: Date | number, properties?: PropertyDict, callback?: Callback): void;
    import(eventName: string, time: Date | number, callback: Callback): void;

    import_batch(eventNames: string[], options?: BatchOptions, callback?: BatchCallback): void;
    import_batch(eventNames: string[], callback?: BatchCallback): void;
    import_batch(events: Event[], callback?: BatchCallback): void;

    alias(distinctId: string, alias: string, callback?: Callback): void;

    people: People;
  }

  interface People {
    set(distinctId: string, properties: PropertyDict, callback?: Callback): void;
    set(distinctId: string, properties: PropertyDict, modifiers?: Modifiers, callback?: Callback): void;
    set(distinctId: string, propertyName: string, value: string | number, modifiers: Modifiers): void;
    set(distinctId: string, propertyName: string, value: string | number, callback?: Callback): void;
    set(distinctId: string, propertyName: string, value: string | number, modifiers: Modifiers, callback: Callback): void;

    unset(distinctId: string, propertyName: string | string[], modifiers?: Modifiers, callback?: Callback): void;
    
    set_once(distinctId: string, propertyName: string, value: string, callback?: Callback): void;
    set_once( distinctId: string, propertyName: string, value: string, modifiers: Modifiers, callback?: Callback): void;
    set_once(distinctId: string, properties: PropertyDict, callback?: Callback): void;
    set_once(distinctId: string, properties: PropertyDict, modifiers?: Modifiers, callback?: Callback): void;

    increment(distinctId: string, propertyName: string, modifiers?: Modifiers, callback?: Callback): void;
    increment(distinctId: string, propertyName: string, incrementBy: number, modifiers: Modifiers, callback?: Callback): void;
    increment(distinctId: string, propertyName: string, incrementBy: number, callback?: Callback): void;
    increment(distinctId: string, properties: NumberMap, modifiers: Modifiers, callback?: Callback): void;
    increment(distinctId: string, properties: NumberMap, callback?: Callback): void;

    append(distinctId: string, propertyName: string, value: any, modifiers: Modifiers, callback?: Callback): void;
    append(distinctId: string, propertyName: string, value: any, callback?: Callback): void;
    append(distinctId: string, properties: PropertyDict, callback?: Callback): void;
    append(distinctId: string, properties: PropertyDict, modifiers: Modifiers, callback?: Callback): void;

    union(distinctId: string, data: UnionData, modifiers?: Modifiers, callback?: Callback): void;
    union(distinctId: string, data: UnionData, callback: Callback): void;

    track_charge(distinctId: string, amount: number | string, properties?: PropertyDict, callback?: Callback): void;
    track_charge(distinctId: string, amount: number | string, properties: PropertyDict, modifiers?: Modifiers, callback?: Callback): void;

    clear_charges(distinctId: string, modifiers?: Modifiers, callback?: Callback): void;
    clear_charges(distinctId: string, callback: Callback): void;

    delete_user(distinctId: string, modifiers?: Modifiers, callback?: Callback): void;
    delete_user(distinctId: string, callback: Callback): void;
  }
}

export = mixpanel;
