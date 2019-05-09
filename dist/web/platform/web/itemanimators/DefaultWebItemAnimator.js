/**
 * Default implementation of RLV layout animations for web. We simply hook in transform transitions to beautifully animate all
 * shift events.
 */
export class DefaultWebItemAnimator {
    constructor() {
        this.shouldAnimateOnce = true;
        this._hasAnimatedOnce = false;
        this._isTimerOn = false;
    }
    animateWillMount(atX, atY, itemIndex) {
        //no need
    }
    animateDidMount(atX, atY, itemRef, itemIndex) {
        //no need
    }
    animateWillUpdate(fromX, fromY, toX, toY, itemRef, itemIndex) {
        this._hasAnimatedOnce = true;
    }
    animateShift(fromX, fromY, toX, toY, itemRef, itemIndex) {
        if (fromX !== toX || fromY !== toY) {
            const element = itemRef;
            if (!this.shouldAnimateOnce || this.shouldAnimateOnce && !this._hasAnimatedOnce) {
                const transitionEndCallback = (event) => {
                    element.style.transition = null;
                    element.removeEventListener("transitionend", transitionEndCallback);
                    this._hasAnimatedOnce = true;
                };
                element.style.transition = "transform 0.15s ease-out";
                element.addEventListener("transitionend", transitionEndCallback, false);
            }
        }
        else {
            if (!this._isTimerOn) {
                this._isTimerOn = true;
                if (!this._hasAnimatedOnce) {
                    setTimeout(() => {
                        this._hasAnimatedOnce = true;
                    }, 1000);
                }
            }
        }
        return false;
    }
    animateWillUnmount(atX, atY, itemRef, itemIndex) {
        //no need
    }
}
//# sourceMappingURL=DefaultWebItemAnimator.js.map