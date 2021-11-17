export namespace RobustPromises {
    type thenableExecutor<T> = () => Thenable<T>;

    export async function retry<T>(retries: number, delay: number, timeout: number, executor: thenableExecutor<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const until = async () => {
                const failed = async () => {
                    // console.log(`Try timed out. Retrying...`);
                    if (--retries > 0)
                        setTimeout(until, delay);
                    else
                        reject();
                };

                var t = setTimeout(failed, timeout);
                try {
                    // console.log(`Try attempts are at ${retries}.`);
                    const result = await executor();
                    clearTimeout(t);
                    // console.log(`Try succeeded!`);
                    resolve(result);
                } catch (err) {
                    clearTimeout(t);
                    console.log(`Try caught an error. ${err}\nRetrying...`);
                    if (--retries > 0)
                        setTimeout(until, delay);
                    else
                        reject();
                }
            }
            setTimeout(until, delay); // primer
        });
    }
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}
