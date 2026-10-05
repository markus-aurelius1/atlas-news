import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // The store identity predates the rename to Tars. Changing it would publish a
  // different app (existing installs would not update and would keep their data
  // in the old app), so it stays.
  appId: 'app.lodestar.study',
  appName: 'Tars',
  webDir: 'dist',
  backgroundColor: '#0a0c14',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_tars',
      iconColor: '#F2C46D',
    },
  },
}

export default config
