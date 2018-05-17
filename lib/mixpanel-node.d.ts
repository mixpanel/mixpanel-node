declare const mixpanel: mixpanel.Mixpanel;

declare namespace mixpanel {
  export type ErrorCallback = (err: Error | undefined) => any;
  export type ErrorsCallback = (errors: [Error] | undefined) => any;

  type Scalar = string | number | boolean;

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
    init(mixpanelToken: string, config?: PropertyDict): Mixpanel;

    track(eventName: string, callback?: ErrorCallback): undefined;
    track(eventName: string, properties: PropertyDict, callback?: ErrorCallback): undefined;

    track_batch(events: Event[], options?: BatchOptions, callback?: ErrorsCallback): undefined;
    track_batch(events: Event[], callback: ErrorsCallback): undefined;
    track_batch(eventNames: string[], options?: BatchOptions, callback?: ErrorsCallback): undefined;
    track_batch(eventNames: string[], callback?: ErrorsCallback): undefined;

    import(eventName: string, time: Date | number, properties?: PropertyDict, callback?: ErrorCallback): undefined;
    import(eventName: string, time: Date | number, callback: ErrorCallback): undefined;

    import_batch(eventNames: string[], options?: BatchOptions, callback?: ErrorsCallback): undefined;
    import_batch(eventNames: string[], callback?: ErrorsCallback): undefined;
    import_batch(events: Event[], callback?: ErrorsCallback): undefined;

    alias(distinctId: string, alias: string, callback?: ErrorCallback): undefined;

    people: People;
  }

  interface People {
    set(distinctId: string, properties: PropertyDict, callback?: ErrorCallback): undefined;
    set(
      distinctId: string,
      properties: PropertyDict,
      modifiers?: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    set(distinctId: string, propertyName: string, value: string | number, modifiers: Modifiers): undefined;
    set(distinctId: string, propertyName: string, value: string | number, callback?: ErrorCallback): undefined;
    set(
      distinctId: string,
      propertyName: string,
      value: string | number,
      modifiers: Modifiers,
      callback: ErrorCallback,
    ): undefined;

    set_once(distinctId: string, propertyName: string, value: string, callback?: ErrorCallback): undefined;
    set_once(
      distinctId: string,
      propertyName: string,
      value: string,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    set_once(distinctId: string, properties: PropertyDict, callback?: ErrorCallback): undefined;
    set_once(
      distinctId: string,
      properties: PropertyDict,
      modifiers?: Modifiers,
      callback?: ErrorCallback,
    ): undefined;

    increment(
      distinctId: string,
      propertyName: string,
      modifiers?: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    increment(
      distinctId: string,
      propertyName: string,
      incrementBy: number,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    increment(distinctId: string, propertyName: string, incrementBy: number, callback?: ErrorCallback): undefined;
    increment(
      distinctId: string,
      properties: NumberMap,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    increment(distinctId: string, properties: NumberMap, callback?: ErrorCallback): undefined;

    append(
      distinctId: string,
      propertyName: string,
      value: any,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    append(distinctId: string, propertyName: string, value: any, callback?: ErrorCallback): undefined;
    append(distinctId: string, properties: PropertyDict, callback?: ErrorCallback): undefined;
    append(
      distinctId: string,
      properties: PropertyDict,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;

    union(distinctId: string, data: UnionData, modifiers?: Modifiers, callback?: ErrorCallback): undefined;
    union(distinctId: string, data: UnionData, callback: ErrorCallback): undefined;

    track_charge(
      distinctId: string,
      amount: number | string,
      properties?: PropertyDict,
      callback?: ErrorCallback,
    ): undefined;
    track_charge(
      distinctId: string,
      amount: number | string,
      properties: PropertyDict,
      modifiers?: Modifiers,
      callback?: ErrorCallback,
    ): undefined;

    clear_charges(distinctId: string, modifiers?: Modifiers, callback?: ErrorCallback): undefined;
    clear_charges(distinctId: string, callback: ErrorCallback): undefined;

    delete_user(distinctId: string, modifiers?: Modifiers, callback?: ErrorCallback): undefined;
    delete_user(distinctId: string, callback: ErrorCallback): undefined;
  }
}

export = mixpanel;
