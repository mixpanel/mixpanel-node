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

    track(eventName: string, callback?: Callback): undefined;
    track(eventName: string, properties: PropertyDict, callback?: Callback): undefined;

    track_batch(events: Event[], options?: BatchOptions, callback?: BatchCallback): undefined;
    track_batch(events: Event[], callback: BatchCallback): undefined;
    track_batch(eventNames: string[], options?: BatchOptions, callback?: BatchCallback): undefined;
    track_batch(eventNames: string[], callback?: BatchCallback): undefined;

    import(eventName: string, time: Date | number, properties?: PropertyDict, callback?: Callback): undefined;
    import(eventName: string, time: Date | number, callback: Callback): undefined;

    import_batch(eventNames: string[], options?: BatchOptions, callback?: BatchCallback): undefined;
    import_batch(eventNames: string[], callback?: BatchCallback): undefined;
    import_batch(events: Event[], callback?: BatchCallback): undefined;

    alias(distinctId: string, alias: string, callback?: Callback): undefined;

    people: People;
  }

  interface People {
    set(distinctId: string, properties: PropertyDict, callback?: Callback): undefined;
    set(
      distinctId: string,
      properties: PropertyDict,
      modifiers?: Modifiers,
      callback?: Callback,
    ): undefined;
    set(distinctId: string, propertyName: string, value: string | number, modifiers: Modifiers): undefined;
    set(distinctId: string, propertyName: string, value: string | number, callback?: Callback): undefined;
    set(
      distinctId: string,
      propertyName: string,
      value: string | number,
      modifiers: Modifiers,
      callback: Callback,
    ): undefined;

    set_once(distinctId: string, propertyName: string, value: string, callback?: Callback): undefined;
    set_once(
      distinctId: string,
      propertyName: string,
      value: string,
      modifiers: Modifiers,
      callback?: Callback,
    ): undefined;
    set_once(distinctId: string, properties: PropertyDict, callback?: Callback): undefined;
    set_once(
      distinctId: string,
      properties: PropertyDict,
      modifiers?: Modifiers,
      callback?: Callback,
    ): undefined;

    increment(
      distinctId: string,
      propertyName: string,
      modifiers?: Modifiers,
      callback?: Callback,
    ): undefined;
    increment(
      distinctId: string,
      propertyName: string,
      incrementBy: number,
      modifiers: Modifiers,
      callback?: Callback,
    ): undefined;
    increment(distinctId: string, propertyName: string, incrementBy: number, callback?: Callback): undefined;
    increment(
      distinctId: string,
      properties: NumberMap,
      modifiers: Modifiers,
      callback?: Callback,
    ): undefined;
    increment(distinctId: string, properties: NumberMap, callback?: Callback): undefined;

    append(
      distinctId: string,
      propertyName: string,
      value: any,
      modifiers: Modifiers,
      callback?: Callback,
    ): undefined;
    append(distinctId: string, propertyName: string, value: any, callback?: Callback): undefined;
    append(distinctId: string, properties: PropertyDict, callback?: Callback): undefined;
    append(
      distinctId: string,
      properties: PropertyDict,
      modifiers: Modifiers,
      callback?: Callback,
    ): undefined;

    union(distinctId: string, data: UnionData, modifiers?: Modifiers, callback?: Callback): undefined;
    union(distinctId: string, data: UnionData, callback: Callback): undefined;

    track_charge(
      distinctId: string,
      amount: number | string,
      properties?: PropertyDict,
      callback?: Callback,
    ): undefined;
    track_charge(
      distinctId: string,
      amount: number | string,
      properties: PropertyDict,
      modifiers?: Modifiers,
      callback?: Callback,
    ): undefined;

    clear_charges(distinctId: string, modifiers?: Modifiers, callback?: Callback): undefined;
    clear_charges(distinctId: string, callback: Callback): undefined;

    delete_user(distinctId: string, modifiers?: Modifiers, callback?: Callback): undefined;
    delete_user(distinctId: string, callback: Callback): undefined;
  }
}

export = mixpanel;
