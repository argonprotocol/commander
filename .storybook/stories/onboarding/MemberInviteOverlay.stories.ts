import type { Meta, StoryObj } from '@storybook/vue3-vite';
import * as Vue from 'vue';
import { userEvent, within } from 'storybook/test';
import { setupMemberInviteScenario } from '../../scenarios/setupOnboardingOverlayScenario.ts';
import basicEmitter from '../../../src-vue/emitters/basicEmitter.ts';
import MemberInviteOverlay from '../../../src-vue/overlays/MemberInviteOverlay.vue';

const meta = {
  title: 'Onboarding/Member invite',
  component: MemberInviteOverlay,
  render: () => ({
    components: { MemberInviteOverlay },
    setup() {
      Vue.onMounted(() => basicEmitter.emit('openMemberInviteOverlay'));
    },
    template: '<MemberInviteOverlay />',
  }),
} satisfies Meta<typeof MemberInviteOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VaultRequired: Story = {
  beforeEach: () => setupMemberInviteScenario('vaultRequired'),
};

export const LoadingCapacity: Story = {
  beforeEach: () => setupMemberInviteScenario('loading'),
};

export const CapacityLoadFailed: Story = {
  beforeEach: () => setupMemberInviteScenario('loadError'),
};

export const CurrentRuntime: Story = {
  beforeEach: () => setupMemberInviteScenario('currentRuntime'),
};

export const FeeWaiverAvailabilityOpen: Story = {
  ...CurrentRuntime,
  play: async () => {
    const canvas = within(document.body);
    await userEvent.click(await canvas.findByRole('button', { name: '7 days' }));
  },
};

export const OnboardingInactive: Story = {
  beforeEach: () => setupMemberInviteScenario('onboardingInactive'),
};

export const BitcoinSpaceRequired: Story = {
  beforeEach: () => setupMemberInviteScenario('bitcoinSpaceRequired'),
};

export const InsufficientBitcoinWaiver: Story = {
  beforeEach: () => setupMemberInviteScenario('insufficientBitcoinWaiver'),
};

export const InsufficientBondCapacity: Story = {
  beforeEach: () => setupMemberInviteScenario('insufficientBondCapacity'),
};

export const SetupInProgress: Story = {
  beforeEach: () => setupMemberInviteScenario('setupProgress'),
  play: async () => {
    await submitInvite();
  },
};

export const Creating: Story = {
  beforeEach: () => setupMemberInviteScenario('creating'),
  play: async () => {
    await submitInvite();
  },
};

export const CreateFailed: Story = {
  beforeEach: () => setupMemberInviteScenario('createError'),
  play: async () => {
    await submitInvite();
  },
};

async function submitInvite() {
  const canvas = within(document.body);
  await userEvent.type(await canvas.findByPlaceholderText('Who is this invite for?'), 'Morgan');
  await userEvent.click(await canvas.findByRole('button', { name: 'Create Invite' }));
}
