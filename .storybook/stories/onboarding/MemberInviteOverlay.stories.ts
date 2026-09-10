import type { Meta, StoryObj } from '@storybook/vue3-vite';
import * as Vue from 'vue';
import { userEvent, within } from 'storybook/test';
import { setupMemberInviteScenario } from '../../scenarios/setupOnboardingOverlayScenario.ts';
import basicEmitter from '../../../src-vue/emitters/basicEmitter.ts';
import MemberInviteOverlay from '../../../src-vue/overlays/MemberInviteOverlay.vue';

const interactive = Vue.ref(false);

const meta = {
  title: 'Onboarding/Member invite',
  component: MemberInviteOverlay,
  render: () => ({
    components: { MemberInviteOverlay },
    setup() {
      Vue.onMounted(() => basicEmitter.emit('openMemberInviteOverlay'));
      return { interactive };
    },
    template: `
      <div v-if="!interactive" class="fixed top-2 right-3 z-[10000] rounded-full border border-slate-400/40 bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
        Fixed state preview
      </div>
      <MemberInviteOverlay :inert="interactive ? undefined : ''" />
    `,
  }),
} satisfies Meta<typeof MemberInviteOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VaultRequired: Story = {
  beforeEach: () => setupFixedScenario('vaultRequired'),
};

export const LoadingCapacity: Story = {
  beforeEach: () => setupFixedScenario('loading'),
};

export const CapacityLoadFailed: Story = {
  beforeEach: () => setupFixedScenario('loadError'),
};

export const CurrentRuntime: Story = {
  beforeEach: () => setupFixedScenario('currentRuntime'),
};

export const FeeWaiverAvailabilityOpen: Story = {
  beforeEach: () => setupInteractiveScenario('currentRuntime'),
  play: async () => {
    const canvas = within(document.body);
    await userEvent.click(await canvas.findByRole('button', { name: '7 days' }));
    interactive.value = false;
  },
};

export const OnboardingInactive: Story = {
  beforeEach: () => setupFixedScenario('onboardingInactive'),
};

export const BitcoinSpaceRequired: Story = {
  beforeEach: () => setupFixedScenario('bitcoinSpaceRequired'),
};

export const InsufficientBitcoinWaiver: Story = {
  beforeEach: () => setupFixedScenario('insufficientBitcoinWaiver'),
};

export const InsufficientBondCapacity: Story = {
  beforeEach: () => setupFixedScenario('insufficientBondCapacity'),
};

export const SetupInProgress: Story = {
  beforeEach: () => setupInteractiveScenario('setupProgress'),
  play: async () => {
    await submitInvite();
    interactive.value = false;
  },
};

export const Creating: Story = {
  beforeEach: () => setupInteractiveScenario('creating'),
  play: async () => {
    await submitInvite();
    interactive.value = false;
  },
};

export const CreateFailed: Story = {
  beforeEach: () => setupInteractiveScenario('createError'),
  play: async () => {
    await submitInvite();
    await Vue.nextTick();
    interactive.value = false;
  },
};

function setupFixedScenario(state: Parameters<typeof setupMemberInviteScenario>[0]) {
  interactive.value = false;
  return setupMemberInviteScenario(state);
}

function setupInteractiveScenario(state: Parameters<typeof setupMemberInviteScenario>[0]) {
  interactive.value = true;
  return setupMemberInviteScenario(state);
}

async function submitInvite() {
  const canvas = within(document.body);
  await userEvent.type(await canvas.findByPlaceholderText('Who is this invite for?'), 'Morgan');
  await userEvent.click(await canvas.findByRole('button', { name: 'Create Invite' }));
}
