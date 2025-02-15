<script setup lang="ts">
import clamp from "lodash/clamp";
import tinycolor from "tinycolor2";
import { computed, nextTick, ref, watchEffect } from "vue";

import { getInputPosition } from "../events";

enum InputMode {
    Hex,
    Hsla,
    Rgba,
}

// enums are not properly exported yet with setup https://github.com/vuejs/vue-next/issues/3571
const IM = InputMode;

const props = withDefaults(defineProps<{ colour?: string; showAlpha?: boolean; vShow?: boolean }>(), {
    colour: "rgba(0, 0, 0, 1)",
    showAlpha: true,
    vShow: true,
});
const emit = defineEmits<{ (e: "update:colour", c: string): void; (e: "input:colour", c: string): void }>();

const alpha = ref<HTMLDivElement | null>(null);
const hue = ref<HTMLDivElement | null>(null);
const modal = ref<HTMLDivElement | null>(null);
const picker = ref<HTMLDivElement | null>(null);
const saturation = ref<HTMLDivElement | null>(null);

const left = ref("0px");
const top = ref("0px");
const transparent = false;
const visible = ref(false);

const inputMode = ref(InputMode.Rgba);

const tc = ref(tinycolor(props.colour));
const hex = computed(() => tc.value.toHex());
const hsl = computed(() => tc.value.toHsl());
const hsv = computed(() => tc.value.toHsv());
const rgb = computed(() => tc.value.toRgb());
const rgbaString = computed(() => tc.value.toRgbString());

watchEffect(() => (tc.value = tinycolor(props.colour)));

const alphaActive = ref(false);
const alphaBackground = computed(
    () =>
        `linear-gradient(to right, rgba(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b}, 0) 0%, rgba(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b}, 1) 100%)`,
);
const alphaLeft = computed(() => `${rgb.value.a * 100}%`);

const hueActive = ref(false);
const hueLeft = computed(() => `${((hsl.value.h === 0 ? hueFallback.value : hsl.value.h) * 100) / 360}%`);
const hueFallback = ref(0);

const saturationActive = ref(false);
const saturationLeft = computed(() => `${hsv.value.s * 100}%`);
const saturationTop = computed(() => `${101 - hsv.value.v * 100}%`);
const saturationBackgroundColour = computed(
    () => `hsl(${hsv.value.s === 0 ? hueFallback.value : hsv.value.h}, 100%, 50%)`,
);

function setPosition(): void {
    let _left = 0;
    let _top = 0;
    const rect = picker.value!.getBoundingClientRect();

    if (rect.right + 224 > window.innerWidth) _left = rect.left - 224;
    else _left = rect.right;

    if (rect.bottom + 242 > window.innerHeight) _top = rect.top - 242;
    else _top = rect.bottom;

    left.value = `${_left}px`;
    top.value = `${_top}px`;
}

function open(event: Event): void {
    setPosition();
    visible.value = true;
    nextTick(() => modal.value!.focus());
    event.preventDefault();
}

function close(): void {
    visible.value = false;
}

function onBlur(event: FocusEvent): void {
    if (event.relatedTarget === null || modal.value === null) {
        close();
    } else {
        const el = event.relatedTarget as HTMLElement;
        if (el === modal.value) return;

        const rect = el.getBoundingClientRect();
        const modalRect = modal.value.getBoundingClientRect();
        if (
            modalRect.left >= rect.left ||
            modalRect.right <= rect.right ||
            modalRect.top >= rect.top ||
            modalRect.bottom <= rect.bottom
        )
            close();
    }
}

function changeModeUp(): void {
    inputMode.value = inputMode.value === InputMode.Rgba ? InputMode.Hex : inputMode.value + 1;
}

function changeModeDown(): void {
    inputMode.value = inputMode.value === InputMode.Hex ? InputMode.Rgba : inputMode.value - 1;
}

function onAlphaDown(event: PointerEvent): void {
    alphaActive.value = true;
    onAlphaMove(event);
}

function onAlphaMove(event: PointerEvent): void {
    if (!alphaActive.value) return;

    const el = alpha.value!.getBoundingClientRect();
    const { x } = getInputPosition(event);

    tc.value = tinycolor({
        ...hsl.value,
        a: clamp((x - el.x) / el.width, 0, 1),
    });
    emit("input:colour", rgbaString.value);
}

function onAlphaUp(): void {
    if (!alphaActive.value) return;

    alphaActive.value = false;
    emit("update:colour", rgbaString.value);
}

function onHueDown(event: PointerEvent): void {
    hueActive.value = true;
    onHueMove(event);
}

function onHueMove(event: PointerEvent): void {
    if (!hueActive.value) return;

    const el = hue.value!.getBoundingClientRect();
    const { x } = getInputPosition(event);
    const h = clamp(360 * ((x - el.x) / el.width), 0, 360);

    tc.value = tinycolor({
        ...hsl.value,
        h,
    });
    hueFallback.value = h;
    emit("input:colour", rgbaString.value);
}

function onHueUp(): void {
    if (!hueActive.value) return;

    hueActive.value = false;
    emit("update:colour", rgbaString.value);
}

function onSaturationDown(event: PointerEvent): void {
    saturationActive.value = true;
    saturation.value!.setPointerCapture(event.pointerId);
    onSaturationMove(event);
}

function onSaturationMove(event: PointerEvent): void {
    if (!saturationActive.value) return;

    const el = saturation.value!.getBoundingClientRect();
    const { x, y } = getInputPosition(event);

    const dX = Math.min(x - el.x, el.width);
    const dY = Math.min(y - el.y, el.height);

    tc.value = tinycolor({
        ...hsv.value,
        s: dX / el.width,
        v: clamp(1 - dY / el.height, 0, 1),
    });
    emit("input:colour", rgbaString.value);
}

function onSaturationUp(event: PointerEvent): void {
    saturation.value!.releasePointerCapture(event.pointerId);
    if (!saturationActive.value) return;

    saturationActive.value = false;
    emit("update:colour", rgbaString.value);
}
</script>

<template>
    <div v-bind="$attrs" v-show="vShow" ref="picker" class="outer" @click="open">
        <div
            class="current-color"
            @click="open"
            :style="
                transparent
                    ? 'background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwH+YwCGIasIUwhT25BVBADtzYNYrHvv4gAAAABJRU5ErkJggg==)'
                    : 'background-color:' + rgbaString
            "
        ></div>
    </div>
    <teleport to="#teleport-modals" v-if="visible">
        <div class="modal" ref="modal" :style="{ left, top }" @blur.capture="onBlur" tabindex="0">
            <div class="saturation-wrapper">
                <div
                    ref="saturation"
                    @pointerdown="onSaturationDown"
                    @pointermove="onSaturationMove"
                    @pointerup="onSaturationUp"
                    class="saturation"
                    :style="{ background: saturationBackgroundColour }"
                >
                    <div class="saturation--white"></div>
                    <div class="saturation--black"></div>
                    <div class="pointer" :style="{ left: saturationLeft, top: saturationTop }">
                        <div class="saturation-circle"></div>
                    </div>
                </div>
            </div>
            <div class="body">
                <div class="sliders">
                    <div class="preview">
                        <div class="checker"></div>
                        <div :style="{ backgroundColor: rgbaString }"></div>
                    </div>
                    <div
                        class="hue"
                        ref="hue"
                        @pointerdown="onHueDown"
                        @pointermove="onHueMove"
                        @pointerup="onHueUp"
                        @pointerleave="onHueUp"
                        role="slider"
                        :aria-valuenow="hsl.h"
                        :aria-valuemin="0"
                        :aria-valuemax="360"
                    >
                        <div class="pointer" :style="{ left: hueLeft }" role="presentation">
                            <div class="picker"></div>
                        </div>
                    </div>
                    <div class="alpha">
                        <div class="checker"></div>
                        <div
                            ref="alpha"
                            @pointerdown="onAlphaDown"
                            @pointermove="onAlphaMove"
                            @pointerup="onAlphaUp"
                            @pointerleave="onAlphaUp"
                            :style="{
                                background: alphaBackground,
                            }"
                        ></div>
                        <div class="pointer" :style="{ left: alphaLeft }">
                            <div class="picker"></div>
                        </div>
                    </div>
                </div>
                <div class="mode">
                    <div
                        class="content"
                        :style="{ gridTemplateColumns: `repeat(${inputMode === IM.Hex ? 1 : 4}, 1fr)` }"
                    >
                        <template v-if="inputMode === IM.Rgba">
                            <input type="text" :value="rgb.r" />
                            <input type="text" :value="rgb.g" />
                            <input type="text" :value="rgb.b" />
                            <input type="text" :value="rgb.a" />
                            <div>R</div>
                            <div>G</div>
                            <div>B</div>
                            <div>A</div>
                        </template>
                        <template v-else-if="inputMode === IM.Hsla">
                            <input type="text" :value="hsl.h.toFixed(0)" />
                            <input type="text" :value="(100 * hsl.s).toFixed(0) + '%'" />
                            <input type="text" :value="(100 * hsl.l).toFixed(0) + '%'" />
                            <input type="text" :value="hsl.a" />
                            <div>H</div>
                            <div>S</div>
                            <div>L</div>
                            <div>A</div>
                        </template>
                        <template v-else>
                            <input type="text" :value="hex" />
                            <div>HEX</div>
                        </template>
                    </div>
                    <div class="switcher">
                        <svg viewBox="0 0 24 12" style="width: 24px" @click="changeModeUp">
                            <path fill="#333" d="M12,5.83L15.17,9L16.58,7.59L12,3L7.41,7.59L8.83,9L12,5.83Z"></path>
                        </svg>
                        <svg viewBox="0 12 24 24" style="width: 24px" @click="changeModeDown">
                            <path fill="#333" d="M12,18.17L8.83,15L7.42,16.41L12,21L16.59,16.41L15.17,15Z"></path>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    </teleport>
</template>

<style scoped lang="scss">
.outer {
    /* position: relative; */
    padding: 5px;
    border: solid 1px black;
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;

    .current-color {
        width: 13px;
        height: 13px;
        background-color: #000;
        border: solid 1px black;
    }
}

.modal {
    position: fixed;
    height: 240px;
    width: 225px;
    display: grid;
    grid-template-rows: 1fr 1fr;
    pointer-events: auto;

    .body {
        background: #fff;
        border-radius: 2px;
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.3);

        .checker {
            background: repeating-conic-gradient(lightgray 0% 25%, transparent 0% 50%) 50% / 10px 10px;
        }

        .sliders {
            padding: 15px;
            display: grid;
            align-items: center;
            grid-template-columns: 45px auto;
            grid-template-areas:
                "preview hue"
                "preview alpha";

            .hue:hover,
            .alpha:hover {
                cursor: pointer;
            }

            .preview {
                grid-area: preview;
                width: 30px;
                height: 30px;
                position: relative;

                > * {
                    position: absolute;
                    border-radius: 15px;
                    width: 100%;
                    height: 100%;
                }
            }

            .hue {
                grid-area: hue;
                background: linear-gradient(90deg, red 0, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, red);
                height: 12px;
                position: relative;
            }

            .alpha {
                grid-area: alpha;
                height: 12px;
                position: relative;
                pointer-events: none;

                > :not(.pointer) {
                    pointer-events: all;
                    width: 100%;
                    height: 100%;
                    position: absolute;
                }
            }
        }

        .mode {
            display: flex;
            padding: 0 10px;

            .switcher {
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .content {
                display: grid;
                padding: 0 7px;
                grid-column-gap: 10px;
                grid-row-gap: 5px;

                > * {
                    place-self: center;
                }

                > input {
                    text-align: center;
                    width: 100%;
                }

                > div {
                    color: #969696;
                }
            }
        }
    }

    .picker {
        cursor: pointer;
        width: 10px;
        height: 12px;
        background: #fff;
        border-radius: 1px;
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
        transform: translateX(-2px);
    }

    .pointer {
        position: absolute;
    }

    .saturation-wrapper {
        position: relative;

        .saturation,
        .saturation--black,
        .saturation--white {
            cursor: pointer;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
        }

        .saturation--black {
            background: linear-gradient(to top, #000, rgba(0, 0, 0, 0));
        }

        .saturation--white {
            background: linear-gradient(to right, #fff, rgba(255, 255, 255, 0));
        }

        .saturation-circle {
            cursor: pointer;
            width: 8px;
            height: 8px;
            box-shadow: 0 0 0 1.5px #fff, inset 0 0 1px 1px rgba(0, 0, 0, 0.3), 0 0 1px 2px rgba(0, 0, 0, 0.4);
            border-radius: 50%;
            transform: translate(-2px, -2px);
        }
    }
}
</style>
