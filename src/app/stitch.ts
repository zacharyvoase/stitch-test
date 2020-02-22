import {Observable, of, combineLatest} from 'rxjs';
import {map, catchError, switchMap} from 'rxjs/operators';

export interface CallType<T> {
    new (...args: any[]): T;
    equals(other: CallType<any>): boolean;
}

interface Group<C, T> {
  callType: CallType<C>;
  equals(group: Group<any, any>): boolean;
  run(calls: C[]): Observable<T[]>;
}

abstract class Stitch<T> {
  static value<T>(t: T): Stitch<T> {
    return new ValueStitch<T>(t);
  }

  static join<A, B>(a: Stitch<A>, b: Stitch<B>): Stitch<[A, B]> {
    return new JoinStitch<A, B>(a, b);
  }

  static collect<T>(values: Array<Stitch<T>>): Stitch<T[]> {
    return new CollectStitch<T>(values);
  }

  static traverse<T, U>(ts: T[], f: (t: T) => Stitch<U>): Stitch<U[]> {
    return Stitch.collect(ts.map(f));
  }

  static callOne<C, T>(call: C, group: Group<C, T>): Stitch<T> {
    return new SingleCallStitch(call, group);
  }

  map<U>(f: (t: T) => U): Stitch<U> {
    return new MapStitch<T, U>(this, f);
  }

  flatMap<U>(f: (t: T) => Stitch<U>): Stitch<U> {
    return new FlatMapStitch<T, U>(this, f);
  }

  handle<U>(f: (e: Error) => U): Stitch<T|U> {
    return new HandleStitch<T, U>(this, f);
  }

  rescue<U>(f: (e: Error) => Stitch<U>): Stitch<T|U> {
    return new RescueStitch<T, U>(this, f);
  }

  abstract run(): Observable<T>;
}

class ValueStitch<T> extends Stitch<T> {
  constructor(readonly value: T) {
    super();
  }

  run(): Observable<T> {
    return of(this.value);
  }
}

class JoinStitch<A, B> extends Stitch<[A, B]> {
  constructor(
      readonly left: Stitch<A>,
      readonly right: Stitch<B>) {
    super();
  }

  run(): Observable<[A, B]> {
    return combineLatest([this.left.run(), this.right.run()]);
  }
}

class CollectStitch<T> extends Stitch<T[]> {
  constructor(
      readonly stitches: Array<Stitch<T>>) {
    super();
  }

  run(): Observable<T[]> {
    return combineLatest(this.stitches.map(stitch => stitch.run()));
  }
}

class CallStitch<C, T> extends Stitch<T[]> {
  constructor(
      readonly calls: C[],
      readonly group: Group<C, T>) {
    super();
  }

  run(): Observable<T[]> {
    return this.group.run(this.calls);
  }
}

class SingleCallStitch<C, T> extends Stitch<T> {
  constructor(
      readonly call: C,
      readonly group: Group<C, T>) {
    super();
  }

  run(): Observable<T> {
    return this.group.run([this.call]).pipe(map(results => results[0]));
  }

}

class MapStitch<T, U> extends Stitch<U> {
  constructor(readonly input: Stitch<T>, readonly func: (t: T) => U) {
    super();
  }

  run(): Observable<U> {
    return this.input.run().pipe(map((x) => this.func(x)));
  }
}

class FlatMapStitch<T, U> extends Stitch<U> {
  constructor(
      readonly input: Stitch<T>,
      readonly func: (t: T) => Stitch<U>) {
    super();
  }
  
  run(): Observable<U> {
    return this.input.run().pipe(
      switchMap((t) => this.func(t).run()));
  }
}

class HandleStitch<T, U> extends Stitch<T|U> {
  constructor(
      readonly input: Stitch<T>,
      readonly handler: (t: Error) => U) {
    super();
  }

  run(): Observable<T|U> {
    return this.input.run().pipe(
      catchError(e => of(this.handler(e))));
  }
}

class RescueStitch<T, U> extends Stitch<T|U> {
  constructor(
    readonly input: Stitch<T>,
    readonly handler: (t: Error) => Stitch<U>) {
    super();
  }

  run(): Observable<T|U> {
    return this.input.run().pipe(
      catchError(e => this.handler(e).run()));
  }
}

interface Role {
  id: string;
  fullName: string;
}

class GetRoleCall {
  constructor(readonly roleId: string) {}

  static equals(other: CallType<any>) {
    return other instanceof GetRoleCall;
  }
}

const RoleIdGroup: Group<GetRoleCall, Role> = {
  callType: GetRoleCall,

  equals(other: Group<any, any>): boolean {
    return Object.is(this, other);
  },

  run(calls: GetRoleCall[]): Observable<Role[]> {
    return of(calls.map(x => {
      return {
        id: x.roleId,
        fullName: `Test ${x.roleId}`,
      };
    }));
  }
};

export const example = Stitch.callOne(new GetRoleCall('123'), RoleIdGroup);