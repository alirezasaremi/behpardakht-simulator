export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class ManualClock implements Clock {
  private currentTime: Date;

  constructor(initialTime: Date) {
    this.currentTime = new Date(initialTime);
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  set(time: Date): void {
    this.currentTime = new Date(time);
  }

  advanceBy(milliseconds: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + milliseconds);
  }
}
