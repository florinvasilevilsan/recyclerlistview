import * as React from "react";
import BaseScrollView from "../../../core/scrollcomponent/BaseScrollView";
import debounce from "lodash-es/debounce";
import { ScrollEventNormalizer } from "./ScrollEventNormalizer";
const scrollEndEventSimulator = debounce((executable) => {
    executable();
}, 1200);
/***
 * A scrollviewer that mimics react native scrollview. Additionally on web it can start listening to window scroll events optionally.
 * Supports both window scroll and scrollable divs inside other divs.
 */
export default class ScrollViewer extends BaseScrollView {
    constructor(args) {
        super(args);
        this._mainDivRef = null;
        this._isScrolling = false;
        this._scrollEventNormalizer = null;
        this._onScroll = this._onScroll.bind(this);
        this._windowOnScroll = this._windowOnScroll.bind(this);
        this._getRelevantOffset = this._getRelevantOffset.bind(this);
        this._setRelevantOffset = this._setRelevantOffset.bind(this);
        this._onWindowResize = this._onWindowResize.bind(this);
        this._isScrollEnd = this._isScrollEnd.bind(this);
        this._trackScrollOccurence = this._trackScrollOccurence.bind(this);
        this._setDivRef = this._setDivRef.bind(this);
    }
    componentDidMount() {
        if (this.props.onSizeChanged) {
            if (!this.props.useWindowScroll && this._mainDivRef) {
                this._startListeningToDivEvents();
                this.props.onSizeChanged({ height: this._mainDivRef.clientHeight, width: this._mainDivRef.clientWidth });
            }
        }
    }
    componentWillMount() {
        if (this.props.onSizeChanged) {
            if (this.props.useWindowScroll) {
                this._startListeningToWindowEvents();
                this.props.onSizeChanged({ height: window.innerHeight, width: window.innerWidth });
            }
        }
    }
    componentWillReceiveProps(nextProps) {
        if (this.props.distanceFromWindow !== nextProps.distanceFromWindow) {
            if (this._mainDivRef) {
                this._scrollEventNormalizer = new ScrollEventNormalizer(this._mainDivRef, nextProps.distanceFromWindow);
            }
        }
    }
    componentWillUnmount() {
        window.removeEventListener("scroll", this._windowOnScroll);
        if (this._mainDivRef) {
            this._mainDivRef.removeEventListener("scroll", this._onScroll);
        }
        window.removeEventListener("resize", this._onWindowResize);
    }
    scrollTo(scrollInput) {
        if (scrollInput.animated) {
            this._doAnimatedScroll(this.props.horizontal ? scrollInput.x : scrollInput.y);
        }
        else {
            this._setRelevantOffset(this.props.horizontal ? scrollInput.x : scrollInput.y);
        }
    }
    render() {
        return !this.props.useWindowScroll
            ? React.createElement("div", { ref: this._setDivRef, style: Object.assign({ WebkitOverflowScrolling: "touch", height: "100%", overflowX: this.props.horizontal ? "scroll" : "hidden", overflowY: !this.props.horizontal ? "scroll" : "hidden", width: "100%" }, this.props.style) },
                React.createElement("div", { style: { position: "relative" } }, this.props.children))
            : React.createElement("div", { ref: this._setDivRef, style: { position: "relative" } }, this.props.children);
    }
    _setDivRef(div) {
        this._mainDivRef = div;
        if (div) {
            this._scrollEventNormalizer = new ScrollEventNormalizer(div, this.props.distanceFromWindow);
        }
        else {
            this._scrollEventNormalizer = null;
        }
    }
    _getRelevantOffset() {
        if (!this.props.useWindowScroll) {
            if (this._mainDivRef) {
                if (this.props.horizontal) {
                    return this._mainDivRef.scrollLeft;
                }
                else {
                    return this._mainDivRef.scrollTop;
                }
            }
            return 0;
        }
        else {
            if (this.props.horizontal) {
                return window.scrollX;
            }
            else {
                return window.scrollY;
            }
        }
    }
    _setRelevantOffset(offset) {
        if (!this.props.useWindowScroll) {
            if (this._mainDivRef) {
                if (this.props.horizontal) {
                    this._mainDivRef.scrollLeft = offset;
                }
                else {
                    this._mainDivRef.scrollTop = offset;
                }
            }
        }
        else {
            if (this.props.horizontal) {
                window.scrollTo(offset + this.props.distanceFromWindow, 0);
            }
            else {
                window.scrollTo(0, offset + this.props.distanceFromWindow);
            }
        }
    }
    _isScrollEnd() {
        if (this._mainDivRef) {
            this._mainDivRef.style.pointerEvents = "auto";
        }
        this._isScrolling = false;
    }
    _trackScrollOccurence() {
        if (!this._isScrolling) {
            if (this._mainDivRef) {
                this._mainDivRef.style.pointerEvents = "none";
            }
            this._isScrolling = true;
        }
        scrollEndEventSimulator(this._isScrollEnd);
    }
    _doAnimatedScroll(offset) {
        let start = this._getRelevantOffset();
        if (offset > start) {
            start = Math.max(offset - 800, start);
        }
        else {
            start = Math.min(offset + 800, start);
        }
        const change = offset - start;
        const increment = 20;
        const duration = 200;
        const animateScroll = (elapsedTime) => {
            elapsedTime += increment;
            const position = this._easeInOut(elapsedTime, start, change, duration);
            this._setRelevantOffset(position);
            if (elapsedTime < duration) {
                window.setTimeout(() => animateScroll(elapsedTime), increment);
            }
        };
        animateScroll(0);
    }
    _startListeningToDivEvents() {
        if (this._mainDivRef) {
            this._mainDivRef.addEventListener("scroll", this._onScroll);
        }
    }
    _startListeningToWindowEvents() {
        window.addEventListener("scroll", this._windowOnScroll);
        if (this.props.canChangeSize) {
            window.addEventListener("resize", this._onWindowResize);
        }
    }
    _onWindowResize() {
        if (this.props.onSizeChanged && this.props.useWindowScroll) {
            this.props.onSizeChanged({ height: window.innerHeight, width: window.innerWidth });
        }
    }
    _windowOnScroll() {
        if (this.props.onScroll) {
            if (this._scrollEventNormalizer) {
                this.props.onScroll(this._scrollEventNormalizer.windowEvent);
            }
        }
    }
    _onScroll() {
        if (this.props.onScroll) {
            if (this._scrollEventNormalizer) {
                this.props.onScroll(this._scrollEventNormalizer.divEvent);
            }
        }
    }
    _easeInOut(currentTime, start, change, duration) {
        currentTime /= duration / 2;
        if (currentTime < 1) {
            return change / 2 * currentTime * currentTime + start;
        }
        currentTime -= 1;
        return (-change) / 2 * (currentTime * (currentTime - 2) - 1) + start;
    }
}
ScrollViewer.defaultProps = {
    canChangeSize: false,
    distanceFromWindow: 0,
    horizontal: false,
    style: null,
    useWindowScroll: false,
};
//# sourceMappingURL=ScrollViewer.js.map