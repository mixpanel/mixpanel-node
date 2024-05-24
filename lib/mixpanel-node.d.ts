declare const mixpanel: mixpanel.Mixpanel;

declare namespace mixpanel {
  export type Callback = (err: Error | undefined) => any;
  export type BatchCallback = (errors: [Error] | undefined) => any;

  type Scalar = string | number | boolean;

  export interface CustomLogger {
    trace(message?: any, ...optionalParams: any[]): void;
    debug(message?: any, ...optionalParams: any[]): void;
    info(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
  }

  export interface InitConfig {
    test: boolean;
    debug: boolean;
    verbose: boolean;
    host: string;
    protocol: string;
    path: string;
    keepAlive: boolean;
    geolocate: boolean;
    logger: CustomLogger;
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
    $latitude?: number;
    $longitude?: number;
  }

  export interface BatchOptions {
    max_concurrent_requests?: number;
    max_batch_size?: number;
  }

  export interface UnionData {
    [key: string]: Scalar | Scalar[];
  }

  export interface RemoveData {
    [key: string]: string | number
  }

  interface Mixpanel {
    init(mixpanelToken: string, config?: Partial<InitConfig>): Mixpanel;

    track(eventName: string, callback: Callback): void;
    track(eventName: string): Promise<void>;
    track(eventName: string, properties: PropertyDict, callback: Callback): void;
    track(eventName: string, properties: PropertyDict): Promise<void>;

    track_batch(events: Event[], options?: BatchOptions, callback?: BatchCallback): void;
    track_batch(events: Event[], callback: BatchCallback): void;
    track_batch(eventNames: string[], options?: BatchOptions, callback?: BatchCallback): void;
    track_batch(eventNames: string[], callback?: BatchCallback): void;

    import(eventName: string, time: Date | number, properties: PropertyDict, callback: Callback): void;
    import(eventName: string, time: Date | number, properties: PropertyDict): Promise<void>;
    import(eventName: string, time: Date | number, callback: Callback): void;
    import(eventName: string, time: Date | number): Promise<void>;

    import_batch(eventNames: string[], options?: BatchOptions, callback?: BatchCallback): void;
    import_batch(eventNames: string[], callback?: BatchCallback): void;
    import_batch(events: Event[], callback?: BatchCallback): void;

    alias(distinctId: string, alias: string, callback?: Callback): void;
    alias(distinctId: string, alias: string): Promise<void>;

    people: People;

    groups: Groups;
  }

  interface People {
    set(distinctId: string, properties: PropertyDict, callback: Callback): void;
    set(distinctId: string, properties: PropertyDict): Promise<void>;
    set(distinctId: string, properties: PropertyDict, modifiers: Modifiers, callback: Callback): void;
    set(distinctId: string, properties: PropertyDict, modifiers: Modifiers): Promise<void>;
    set(distinctId: string, propertyName: string, value: string | number, modifiers: Modifiers, callback: Callback): void;
    set(distinctId: string, propertyName: string, value: string | number, modifiers: Modifiers): Promise<void>;
    set(distinctId: string, propertyName: string, value: string | number, callback: Callback): void;
    set(distinctId: string, propertyName: string, value: string | number): Promise<void>;
    set(distinctId: string, propertyName: string, value: string | number, modifiers: Modifiers, callback: Callback): void;
    set(distinctId: string, propertyName: string, value: string | number, modifiers: Modifiers): Promise<void>;

    unset(distinctId: string, propertyName: string | string[], callback: Callback): void;
    unset(distinctId: string, propertyName: string | string[]): Promise<void>;
    unset(distinctId: string, propertyName: string | string[], modifiers?: Modifiers, callback: Callback): void;
    unset(distinctId: string, propertyName: string | string[], modifiers?: Modifiers): Promise<void>;

    set_once(distinctId: string, propertyName: string, value: string, callback: Callback): void;
    set_once(distinctId: string, propertyName: string, value: string): Promise<void>;
    set_once(distinctId: string, propertyName: string, value: string, modifiers: Modifiers, callback: Callback): void;
    set_once(distinctId: string, propertyName: string, value: string, modifiers: Modifiers): Promise<void>;
    set_once(distinctId: string, properties: PropertyDict, callback: Callback): void;
    set_once(distinctId: string, properties: PropertyDict): Promise<void>;
    set_once(distinctId: string, properties: PropertyDict, modifiers?: Modifiers, callback: Callback): void;
    set_once(distinctId: string, properties: PropertyDict, modifiers?: Modifiers): Promise<void>;

    increment(distinctId: string, propertyName: string, modifiers?: Modifiers, callback: Callback): void;
    increment(distinctId: string, propertyName: string, modifiers?: Modifiers): Promise<void>;
    increment(distinctId: string, propertyName: string, incrementBy: number, modifiers: Modifiers, callback: Callback): void;
    increment(distinctId: string, propertyName: string, incrementBy: number, modifiers: Modifiers): Promise<void>;
    increment(distinctId: string, propertyName: string, incrementBy: number, callback: Callback): void;
    increment(distinctId: string, propertyName: string, incrementBy: number): Promise<void>;
    increment(distinctId: string, properties: NumberMap, modifiers: Modifiers, callback: Callback): void;
    increment(distinctId: string, properties: NumberMap, modifiers: Modifiers): Promise<void>;
    increment(distinctId: string, properties: NumberMap, callback: Callback): void;
    increment(distinctId: string, properties: NumberMap): Promise<void>;

    append(distinctId: string, propertyName: string, value: any, modifiers: Modifiers, callback: Callback): void;
    append(distinctId: string, propertyName: string, value: any, modifiers: Modifiers): Promise<void>;
    append(distinctId: string, propertyName: string, value: any, callback: Callback): void;
    append(distinctId: string, propertyName: string, value: any): Promise<void>;
    append(distinctId: string, properties: PropertyDict, callback: Callback): void;
    append(distinctId: string, properties: PropertyDict): Promise<void>;
    append(distinctId: string, properties: PropertyDict, modifiers: Modifiers, callback: Callback): void;
    append(distinctId: string, properties: PropertyDict, modifiers: Modifiers): Promise<void>;

    union(distinctId: string, data: UnionData, modifiers: Modifiers, callback: Callback): void;
    union(distinctId: string, data: UnionData, modifiers: Modifiers): Promise<void>;
    union(distinctId: string, data: UnionData, callback: Callback): void;
    union(distinctId: string, data: UnionData): Promise<void>;

    remove(distinctId: string, data: RemoveData, modifiers: Modifiers, callback: Callback): void;
    remove(distinctId: string, data: RemoveData, modifiers: Modifiers): Promise<void>;
    remove(distinctId: string, data: RemoveData, callback: Callback): void;
    remove(distinctId: string, data: RemoveData): Promise<void>;

    track_charge(distinctId: string, amount: number | string, callback: Callback): void;
    track_charge(distinctId: string, amount: number | string): Promise<void>;
    track_charge(distinctId: string, amount: number | string, properties: PropertyDict, callback: Callback): void;
    track_charge(distinctId: string, amount: number | string, properties: PropertyDict): Promise<void>;
    track_charge(distinctId: string, amount: number | string, properties: PropertyDict, modifiers: Modifiers, callback: Callback): void;
    track_charge(distinctId: string, amount: number | string, properties: PropertyDict, modifiers: Modifiers): Promise<void>;

    clear_charges(distinctId: string, modifiers: Modifiers, callback: Callback): void;
    clear_charges(distinctId: string, modifiers: Modifiers): Promise<void>;
    clear_charges(distinctId: string, callback: Callback): void;
    clear_charges(distinctId: string): Promise<void>;

    delete_user(distinctId: string, modifiers: Modifiers, callback: Callback): void;
    delete_user(distinctId: string, modifiers: Modifiers): Promise<void>;
    delete_user(distinctId: string, callback: Callback): void;
    delete_user(distinctId: string): Promise<void>;
  }

  interface Groups {
    set(groupKey: string, groupId: string, properties: PropertyDict, callback: Callback): void;
    set(groupKey: string, groupId: string, properties: PropertyDict): Promise<void>;
    set(groupKey: string, groupId: string, properties: PropertyDict, modifiers: Modifiers, callback: Callback): void;
    set(groupKey: string, groupId: string, properties: PropertyDict, modifiers: Modifiers): Promise<void>;
    set(groupKey: string, groupId: string, propertyName: string, value: string | number, modifiers: Modifiers, callback: Callback): void;
    set(groupKey: string, groupId: string, propertyName: string, value: string | number, modifiers: Modifiers): Promise<void>;
    set(groupKey: string, groupId: string, propertyName: string, value: string | number, callback: Callback): void;
    set(groupKey: string, groupId: string, propertyName: string, value: string | number): Promise<void>;
    set(groupKey: string, groupId: string, propertyName: string, value: string | number, modifiers: Modifiers, callback: Callback): void;
    set(groupKey: string, groupId: string, propertyName: string, value: string | number, modifiers: Modifiers): Promise<void>;

    unset(groupKey: string, groupId: string, propertyName: string | string[], callback: Callback): void;
    unset(groupKey: string, groupId: string, propertyName: string | string[]): Promise<void>;
    unset(groupKey: string, groupId: string, propertyName: string | string[], modifiers: Modifiers, callback: Callback): void;
    unset(groupKey: string, groupId: string, propertyName: string | string[], modifiers: Modifiers): Promise<void>;

    set_once(groupKey: string, groupId: string, propertyName: string, value: string, callback: Callback): void;
    set_once(groupKey: string, groupId: string, propertyName: string, value: string): Promise<void>;
    set_once( groupKey: string, groupId: string, propertyName: string, value: string, modifiers: Modifiers, callback?: Callback): void;
    set_once( groupKey: string, groupId: string, propertyName: string, value: string, modifiers: Modifiers): Promise<void>;
    set_once(groupKey: string, groupId: string, properties: PropertyDict, callback: Callback): void;
    set_once(groupKey: string, groupId: string, properties: PropertyDict): Promise<void>;
    set_once(groupKey: string, groupId: string, properties: PropertyDict, modifiers: Modifiers, callback: Callback): void;
    set_once(groupKey: string, groupId: string, properties: PropertyDict, modifiers: Modifiers): Promise<void>;

    union(groupKey: string, groupId: string, data: UnionData, modifiers: Modifiers, callback: Callback): void;
    union(groupKey: string, groupId: string, data: UnionData, modifiers: Modifiers): Promise<void>;
    union(groupKey: string, groupId: string, data: UnionData, callback: Callback): void;
    union(groupKey: string, groupId: string, data: UnionData): Promise<void>;

    remove(groupKey: string, groupId: string, data: RemoveData, modifiers: Modifiers, callback: Callback): void;
    remove(groupKey: string, groupId: string, data: RemoveData, modifiers: Modifiers): Promise<void>;
    remove(groupKey: string, groupId: string, data: RemoveData, callback: Callback): void;
    remove(groupKey: string, groupId: string, data: RemoveData): Promise<void>;

    delete_group(groupKey: string, groupId: string, modifiers: Modifiers, callback: Callback): void;
    delete_group(groupKey: string, groupId: string, modifiers: Modifiers): Promise<void>;
    delete_group(groupKey: string, groupId: string, callback: Callback): void;
    delete_group(groupKey: string, groupId: string): Promise<void>;
  }
}

export = mixpanel;
