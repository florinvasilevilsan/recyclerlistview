export class BaseItemAnimator {
    animateWillMount(atX, atY, itemIndex) {
        //no need
    }
    animateDidMount(atX, atY, itemRef, itemIndex) {
        //no need
    }
    animateWillUpdate(fromX, fromY, toX, toY, itemRef, itemIndex) {
        //no need
    }
    animateShift(fromX, fromY, toX, toY, itemRef, itemIndex) {
        return false;
    }
    animateWillUnmount(atX, atY, itemRef, itemIndex) {
        //no need
    }
}
BaseItemAnimator.USE_NATIVE_DRIVER = true;
//# sourceMappingURL=ItemAnimator.js.map