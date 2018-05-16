declare const mixpanel: mixpanel.Mixpanel;

declare namespace mixpanel {
  export type DistinctId = string;

  export type ErrorCallback = (err: Error | undefined) => any;
  export type ErrorsCallback = (errors: [Error] | undefined) => any;

  type Scalar = string | number | boolean;

  export interface PropertyMap {
    [key: string]: any;
  }

  export interface NumberMap {
    [key: string]: number;
  }

  export interface Event {
    event: string;
    properties: PropertyMap;
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
    init(mixpanelToken: string, config?: PropertyMap): Mixpanel;

    track(eventName: string, callback?: ErrorCallback): undefined;
    track(eventName: string, properties: Object, callback?: ErrorCallback): undefined;

    track_batch(events: Event[], options?: BatchOptions, callback?: ErrorsCallback): undefined;
    track_batch(events: Event[], callback: ErrorsCallback): undefined;
    track_batch(eventNames: string[], options?: BatchOptions, callback?: ErrorsCallback): undefined;
    track_batch(eventNames: string[], callback?: ErrorsCallback): undefined;

    import(eventName: string, time: Date | number, properties?: Object, callback?: ErrorCallback): undefined;
    import(eventName: string, time: Date | number, callback: ErrorCallback): undefined;

    import_batch(eventNames: string[], options?: BatchOptions, callback?: ErrorsCallback): undefined;
    import_batch(eventNames: string[], callback?: ErrorsCallback): undefined;
    import_batch(events: Event[], callback?: ErrorsCallback): undefined;

    alias(distinctId: DistinctId, alias: string, callback?: ErrorCallback): undefined;

    people: People;
  }

  interface People {
    set(distinctId: DistinctId, properties: PropertyMap, callback?: ErrorCallback): undefined;
    set(
      distinctId: DistinctId,
      properties: PropertyMap,
      modifiers?: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    set(distinctId: DistinctId, propertyName: string, value: string | number, modifiers: Modifiers): undefined;
    set(distinctId: DistinctId, propertyName: string, value: string | number, callback?: ErrorCallback): undefined;
    set(
      distinctId: DistinctId,
      propertyName: string,
      value: string | number,
      modifiers: Modifiers,
      callback: ErrorCallback,
    ): undefined;

    set_once(distinctId: DistinctId, propertyName: string, value: string, callback?: ErrorCallback): undefined;
    set_once(
      distinctId: DistinctId,
      propertyName: string,
      value: string,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    set_once(distinctId: DistinctId, properties: PropertyMap, callback?: ErrorCallback): undefined;
    set_once(
      distinctId: DistinctId,
      properties: PropertyMap,
      modifiers?: Modifiers,
      callback?: ErrorCallback,
    ): undefined;

    increment(
      distinctId: DistinctId,
      propertyName: string,
      modifiers?: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    increment(
      distinctId: DistinctId,
      propertyName: string,
      incrementBy: number,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    increment(distinctId: DistinctId, propertyName: string, incrementBy: number, callback?: ErrorCallback): undefined;
    increment(
      distinctId: DistinctId,
      properties: NumberMap,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    increment(distinctId: DistinctId, properties: NumberMap, callback?: ErrorCallback): undefined;

    append(
      distinctId: DistinctId,
      propertyName: string,
      value: any,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;
    append(distinctId: DistinctId, propertyName: string, value: any, callback?: ErrorCallback): undefined;
    append(distinctId: DistinctId, properties: PropertyMap, callback?: ErrorCallback): undefined;
    append(
      distinctId: DistinctId,
      properties: PropertyMap,
      modifiers: Modifiers,
      callback?: ErrorCallback,
    ): undefined;

    union(distinctId: DistinctId, data: UnionData, modifiers?: Modifiers, callback?: ErrorCallback): undefined;
    union(distinctId: DistinctId, data: UnionData, callback: ErrorCallback): undefined;

    track_charge(
      distinctId: DistinctId,
      amount: number | string,
      properties?: PropertyMap,
      callback?: ErrorCallback,
    ): undefined;
    track_charge(
      distinctId: DistinctId,
      amount: number | string,
      properties: PropertyMap,
      modifiers?: Modifiers,
      callback?: ErrorCallback,
    ): undefined;

    clear_charges(distinctId: DistinctId, modifiers?: Modifiers, callback?: ErrorCallback): undefined;
    clear_charges(distinctId: DistinctId, callback: ErrorCallback): undefined;

    delete_user(distinctId: DistinctId, modifiers?: Modifiers, callback?: ErrorCallback): undefined;
    delete_user(distinctId: DistinctId, callback: ErrorCallback): undefined;
  }
}

export = mixpanel;
