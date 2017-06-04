import { IdGenerator } from '../IdGenerator';

const eventTypeField = '@eventType';

export type EventOptions = {issuerCommandId: string, eventId?: string};

export class Event {
  eventId: string;
  issuerCommandId: string;
  static eventClasses = new Map<string, Function>();

  constructor(obj: EventOptions) {
    this.issuerCommandId = obj.issuerCommandId;
    this.eventId = obj.eventId || IdGenerator.generate();
    this[eventTypeField] = this.constructor.name;
  }
  getEventId(): string {
    return this.eventId;
  }
  getIssuerCommandId(): string {
    return this.issuerCommandId;
  }
  // copyFrom(from: Object, properties: Array<string>, defaults?: Object) {
  //   properties.forEach((p) => {
  //     if (Object.hasOwnProperty.call(from, p)) {
  //       this[p] = from[p];
  //     } else if (defaults && Object.hasOwnProperty.call(defaults, p)) {
  //       if (defaults[p] instanceof Function) {
  //         this[p] = defaults[p]();
  //       } else {
  //         this[p] = defaults[p];
  //       }
  //     }
  //   });
  // }
  static registerEventClass(eventClass: Function) {
    Event.eventClasses.set(eventClass.name, eventClass);
  }
  static fromObject(obj: Object): Event {
    if (!Object.hasOwnProperty.call(obj, eventTypeField)) {
      throw new Error(`Can't deserialise object into typed instance because it doesn't have an ${eventTypeField} field`);
    }
    const type = obj[eventTypeField];
    if (!Event.eventClasses.has(type)) {
      throw new Error(`Unknown event type ${type}`);
    }
    const typeConstructor = Event.eventClasses.get(type);
// eslint-disable-next-line new-cap
    return Reflect.construct(typeConstructor, [obj]);
  }
}

