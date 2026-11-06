const navigation = {
  parent: ['Overview', 'Allowance rules', 'Approvals', 'Activity', 'Savings', 'Deposit'],
  student: ['Home', 'Activity', 'Savings', 'My Money'],
};

export const MOCK_BADGE_TEXT = 'MOCK DATA · development mode';
export const MOCK_DISCLOSURE = 'Preview only. Credentials are not checked or saved. The displayed role comes from the configured mock identity.';

export function getRoleView(user) {
  if (!user || !['parent', 'student'].includes(user.role)) {
    throw new Error('The account role is not supported by this shell.');
  }
  return {
    role: user.role,
    title: user.role === 'parent' ? 'Parent view' : 'Student view',
    navigation: [...navigation[user.role]],
    // Keep the route empty until this role's screen contracts and designs exist.
    message: 'Shell preview only. This screen has no approved layout or connected account data yet.',
  };
}

export function getPageTitle(page) {
  return page || 'Overview';
}
