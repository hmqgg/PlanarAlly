<script setup lang="ts">
import { computed } from "vue";

import { useModal } from "../../../../core/plugins/modals/plugin";
import { baseAdjust, getValue } from "../../../../core/utils";
import { getPattern, patternToString } from "../../../layers/floor";
import type { BackgroundPattern } from "../../../models/floor";

const props = defineProps<{ pattern: string }>();
const emit = defineEmits<{ (e: "update:pattern", p: string): void }>();

const modals = useModal();

const defaultPattern: BackgroundPattern = {
    hash: "",
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
};

const backgroundPattern = computed(() => getPattern(props.pattern) ?? defaultPattern);

async function setPatternImage(): Promise<void> {
    const data = await modals.assetPicker();
    if (data === undefined || data.file_hash === undefined) return;

    emit("update:pattern", patternToString({ ...backgroundPattern.value, hash: data.file_hash }));
}

function setPatternData(data: { offsetX?: Event; offsetY?: Event; scaleX?: Event; scaleY?: Event }): void {
    const pattern = backgroundPattern.value;
    const offsetX = data.offsetX ? Number.parseInt(getValue(data.offsetX)) : pattern.offsetX;
    const offsetY = data.offsetY ? Number.parseInt(getValue(data.offsetY)) : pattern.offsetY;
    const scaleX = data.scaleX ? Number.parseInt(getValue(data.scaleX)) / 100 : pattern.scaleX;
    const scaleY = data.scaleY ? Number.parseInt(getValue(data.scaleY)) / 100 : pattern.scaleY;

    const newPattern = { ...pattern, offsetX, offsetY, scaleX, scaleY };

    emit("update:pattern", patternToString(newPattern));
}
</script>

<template>
    <div>Pattern</div>
    <div>
        <img
            v-if="backgroundPattern.hash !== ''"
            alt="Pattern image preview"
            :src="baseAdjust('/static/assets/' + backgroundPattern.hash)"
            class="pattern-preview"
        />
        <font-awesome-icon id="set-pattern" icon="plus-square" title="Set a pattern" @click="setPatternImage" />
    </div>
    <div></div>

    <div>Offset</div>
    <div>
        <input type="number" :value="backgroundPattern.offsetX" @change="setPatternData({ offsetX: $event })" />
        <input type="number" :value="backgroundPattern.offsetY" @change="setPatternData({ offsetY: $event })" />
    </div>
    <div></div>

    <div>Scale</div>
    <div>
        <input
            type="number"
            min="1"
            :value="100 * backgroundPattern.scaleX"
            @change="setPatternData({ scaleX: $event })"
        />
        <input
            type="number"
            min="1"
            :value="100 * backgroundPattern.scaleY"
            @change="setPatternData({ scaleY: $event })"
        />
    </div>
    <div></div>
</template>

<style scoped lang="scss">
.pattern-preview {
    max-width: 100px;
    max-height: 100px;
}
</style>
