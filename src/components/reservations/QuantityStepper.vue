<script setup>
// − / + buttons around a number box. The parent owns the quantity: it passes
// it in as a prop and this component emits 'change' with the new number.
const props = defineProps({
  quantity: { type: [Number, String], required: true },
  // Highest allowed value; 0 means no limit here (the database still checks).
  max: { type: Number, default: 0 },
  // id for the parent's <label for="...">
  inputId: { type: String, required: true },
  invalid: { type: Boolean, default: false },
  testid: { type: String, default: '' },
})
const emit = defineEmits(['change'])

function canDecrease() {
  return Number(props.quantity) > 1
}

function canIncrease() {
  return props.max === 0 || Number(props.quantity) < props.max
}

function decrease() {
  if (canDecrease()) emit('change', Number(props.quantity) - 1)
}

function increase() {
  // An empty box counts as 0, so + gives 1.
  if (canIncrease()) emit('change', Number(props.quantity) + 1)
}

// Typing in the box works like v-model.number: a number, or '' while empty.
function onInput(event) {
  const text = event.target.value
  if (text === '') emit('change', '')
  else emit('change', Number(text))
}
</script>

<template>
  <div class="quantity-stepper" :class="{ 'is-invalid': invalid }">
    <button
      type="button"
      class="stepper-button"
      aria-label="One portion fewer"
      :disabled="!canDecrease()"
      @click="decrease"
    >
      −
    </button>
    <input
      :id="inputId"
      :value="quantity"
      type="number"
      min="1"
      step="1"
      class="stepper-input"
      :data-testid="testid"
      @input="onInput"
    />
    <button
      type="button"
      class="stepper-button"
      aria-label="One portion more"
      :disabled="!canIncrease()"
      @click="increase"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.quantity-stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-paper);
  overflow: hidden;
}
.quantity-stepper:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px #ad453218;
}
.quantity-stepper.is-invalid {
  border-color: var(--bs-danger);
}
.stepper-button {
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
  color: var(--color-accent);
  font-size: 20px;
  line-height: 1;
}
.stepper-button:hover:not(:disabled) {
  background: var(--color-bg);
}
.stepper-button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}
.stepper-button:disabled {
  color: var(--color-line);
}
.stepper-input {
  width: 3rem;
  border: 0;
  background: transparent;
  text-align: center;
  font-weight: 600;
  /* Hide the browser's own small arrows; the − and + buttons replace them. */
  appearance: textfield;
}
.stepper-input::-webkit-outer-spin-button,
.stepper-input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.stepper-input:focus {
  outline: none;
}
</style>
