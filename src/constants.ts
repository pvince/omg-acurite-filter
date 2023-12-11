export const MS_IN_SECOND = 1000;

export const SECONDS_IN_MINUTE = 60;

export const MS_IN_MINUTE = SECONDS_IN_MINUTE * MS_IN_SECOND;

export const MINUTES_IN_HOUR = 60;

export const HOURS_IN_DAY = 24;

export const MS_IN_DAY = HOURS_IN_DAY * MINUTES_IN_HOUR * MS_IN_MINUTE;

export const MS_IN_HOUR = MINUTES_IN_HOUR * MS_IN_MINUTE;

/**
 * Helpfully converts 'sleep' to a promise.
 * @param ms_duration - How long should we sleep?
 * @returns - Promise that resolves when sleep is done.
 */
export async function sleepPromise(ms_duration: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms_duration);
  });
}
