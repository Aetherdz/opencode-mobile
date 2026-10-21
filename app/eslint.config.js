const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  { ignores: ['dist/**', 'node_modules/**', '.expo/**'] },
  {
    rules: {
      // Reanimated shared values are intentionally mutable; the compiler rule
      // cannot model worklet-owned state. Controlled sheets and drafts also
      // synchronize local state from props in an effect by design.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
