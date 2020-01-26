export class Mutex<T> {

    owner: T = null;
    acquired: boolean = false;

    public acquire(owner: T): boolean {
        if (this.acquired) return false;
        this.acquired = true;
        this.owner = owner;
        return true;
    }

    public getOwner(): T {
        return this.owner;
    }

    public isOwned(owner: T): boolean {
        return this.acquired && this.owner == owner;
    }

    public isLocked(): boolean {
        return this.acquired;
    }

    public release(owner: T): boolean {
        if (!this.acquired || this.owner != owner) return false;
        this.acquired = false;
        this.owner = null;
        return true;
    }
}