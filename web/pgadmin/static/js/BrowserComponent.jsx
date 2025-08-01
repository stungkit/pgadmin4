/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2025, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

import React, {useEffect, useMemo, useState } from 'react';
import AppMenuBar from './AppMenuBar';
import ObjectBreadcrumbs from './components/ObjectBreadcrumbs';
import Layout, { LAYOUT_EVENTS, LayoutDocker, getDefaultGroup } from './helpers/Layout';
import gettext from 'sources/gettext';
import ObjectExplorer from './tree/ObjectExplorer';
import Properties from '../../misc/properties/Properties';
import SQL from '../../misc/sql/static/js/SQL';
import Statistics from '../../misc/statistics/static/js/Statistics';
import { BROWSER_PANELS, WORKSPACES } from '../../browser/static/js/constants';
import Dependencies from '../../misc/dependencies/static/js/Dependencies';
import Dependents from '../../misc/dependents/static/js/Dependents';
import ModalProvider from './helpers/ModalProvider';
import { NotifierProvider } from './helpers/Notifier';
import ObjectExplorerToolbar from './tree/ObjectExplorer/ObjectExplorerToolbar';
import MainMoreToolbar from './helpers/MainMoreToolbar';
import Dashboard from '../../dashboard/static/js/Dashboard';
import usePreferences from '../../preferences/static/js/store';
import { getBrowser } from './utils';
import PropTypes from 'prop-types';
import Processes from '../../misc/bgprocess/static/js/Processes';
import { useBeforeUnload } from './custom_hooks';
import pgWindow from 'sources/window';
import WorkspaceToolbar from '../../misc/workspaces/static/js/WorkspaceToolbar';
import { useWorkspace, WorkspaceProvider } from '../../misc/workspaces/static/js/WorkspaceProvider';
import { PgAdminProvider, usePgAdmin } from './PgAdminProvider';
import PreferencesComponent from '../../preferences/static/js/components/PreferencesComponent';
import { ApplicationStateProvider } from '../../settings/static/ApplicationStateProvider';
import { appAutoUpdateNotifier } from './helpers/appAutoUpdateNotifier';

const objectExplorerGroup  = {
  tabLocked: true,
  floatable: false,
  panelExtra: () => <ObjectExplorerToolbar />
};

export const processesPanelData = {
  id: BROWSER_PANELS.PROCESSES, title: gettext('Processes'), content: <Processes />, closable: true, group: 'playground'
};

export const preferencesPanelData = {
  id: BROWSER_PANELS.PREFERENCES, title: gettext('Preferences'), content: <PreferencesComponent panelId={BROWSER_PANELS.PREFERENCES} />, closable: true, manualClose: true, group: 'playground'
};

export const defaultTabsData = [
  {
    id: BROWSER_PANELS.DASHBOARD, title: gettext('Dashboard'), content: <Dashboard />, closable: true, group: 'playground'
  },
  {
    id: BROWSER_PANELS.PROPERTIES, title: gettext('Properties'), content: <Properties />, closable: true, group: 'playground'
  },
  {
    id: BROWSER_PANELS.SQL, title: gettext('SQL'), content: <SQL />, closable: true, group: 'playground'
  },
  {
    id: BROWSER_PANELS.STATISTICS, title: gettext('Statistics'), content: <Statistics />, closable: true, group: 'playground'
  },
  {
    id: BROWSER_PANELS.DEPENDENCIES, title: gettext('Dependencies'), content: <Dependencies />, closable: true, group: 'playground'
  },
  {
    id: BROWSER_PANELS.DEPENDENTS, title: gettext('Dependents'), content: <Dependents />, closable: true, group: 'playground'
  },
  processesPanelData,
];

const getMorePanelGroup = (tabsData) => {
  return {
    ...getDefaultGroup(),
    panelExtra: () => <MainMoreToolbar tabsData={tabsData}/>
  };
};

let defaultLayout = {
  dockbox: {
    mode: 'vertical',
    children: [
      {
        mode: 'horizontal',
        children: [
          {
            size: 20,
            tabs: [
              LayoutDocker.getPanel({
                id: BROWSER_PANELS.OBJECT_EXPLORER,
                title: gettext('Object Explorer'),
                content: <ObjectExplorer />,
                group: 'object-explorer'
              }),
            ],
          },
          {
            size: 80,
            id: BROWSER_PANELS.MAIN,
            group: 'playground',
            tabs: defaultTabsData.map((t)=>LayoutDocker.getPanel(t)),
            panelLock: {panelStyle: 'playground'},
          }
        ]
      },
    ]
  },
};

function Layouts({browser}) {
  const pgAdmin = usePgAdmin();
  const {config, enabled, currentWorkspace} = useWorkspace();
  return (
    <ApplicationStateProvider>
      <div style={{display: 'flex', height: (browser != 'Electron' ? 'calc(100% - 30px)' : '100%')}}>
        {enabled && <WorkspaceToolbar/> }
        <Layout
          getLayoutInstance={(obj)=>{
            pgAdmin.Browser.docker.default_workspace = obj;
          }}
          defaultLayout={defaultLayout}
          layoutId='Browser/Layout'
          savedLayout={pgAdmin.Browser.utils.layout['Browser/Layout']}
          groups={{
            'object-explorer': objectExplorerGroup,
            'playground': getMorePanelGroup(defaultTabsData),
          }}
          noContextGroups={['object-explorer']}
          resetToTabPanel={BROWSER_PANELS.MAIN}
          enableToolEvents
          isLayoutVisible={!enabled || currentWorkspace == WORKSPACES.DEFAULT}
        />
        {enabled && config.map((item)=>(
          <Layout
            key={item.docker}
            getLayoutInstance={(obj)=>{
              pgAdmin.Browser.docker[item.docker] = obj;
              obj.eventBus.fireEvent(LAYOUT_EVENTS.INIT);
            }}
            defaultLayout={item.layout}
            layoutId={`Workspace/Layout-${item.workspace}`}
            savedLayout={pgAdmin.Browser.utils.layout[`Workspace/Layout-${item.workspace}`]}
            groups={{
              'playground': item?.tabsData ? getMorePanelGroup(item?.tabsData) : {...getDefaultGroup()},
            }}
            resetToTabPanel={BROWSER_PANELS.MAIN}
            isLayoutVisible={currentWorkspace == item.workspace}
          />
        ))}
      </div>
    </ApplicationStateProvider>
  );
}
Layouts.propTypes = {
  browser: PropTypes.string,
};

export default function BrowserComponent({pgAdmin}) {

  const {isLoading, failed, getPreferencesForModule} = usePreferences();
  let { name: browser } = useMemo(()=>getBrowser(), []);
  const [uiReady, setUiReady] = useState(false);
  const confirmOnClose = getPreferencesForModule('browser').confirm_on_refresh_close;
  useBeforeUnload({
    enabled: confirmOnClose,
    beforeClose: (forceClose)=>{
      window.electronUI?.focus();
      pgAdmin.Browser.notifier.confirm(
        gettext('Quit pgAdmin 4'),
        gettext('Are you sure you want to quit the application?'),
        function() { forceClose(); },
        function() { return true; },
        gettext('Yes'),
        gettext('No'),
        'default',
        'id-app-quit'
      );
    },
    isNewTab: true,
  });

  // Called when Install and Restart btn called for auto-update install
  function installUpdate() {
    if (window.electronUI) {
      window.electronUI.sendDataForAppUpdate({
        'install_update_now': true
      });
    }}
  
  // Listen for auto-update events from the Electron main process and display notifications
  // to the user based on the update status (e.g., update available, downloading, downloaded, installed, or error).
  if (window.electronUI && typeof window.electronUI.notifyAppAutoUpdate === 'function') {
    window.electronUI.notifyAppAutoUpdate((data)=>{
      if (data?.check_version_update) {
        pgAdmin.Browser.check_version_update(true);
      } else if (data.update_downloading) {
        appAutoUpdateNotifier('Update downloading...', 'info', null, 10000);
      } else if (data.no_update_available) {
        appAutoUpdateNotifier('No update available...', 'info', null, 10000);
      } else if (data.update_downloaded) {
        const UPDATE_DOWNLOADED_MESSAGE = gettext('An update is ready. Restart the app now to install it, or later to keep using the current version.');
        appAutoUpdateNotifier(UPDATE_DOWNLOADED_MESSAGE, 'warning', installUpdate, null, 'Update downloaded', 'update_downloaded');
      } else if (data.error) {
        appAutoUpdateNotifier(`${data.errMsg}`, 'error');
      } else if (data.update_installed) {
        const UPDATE_INSTALLED_MESSAGE = gettext('Update installed successfully!');
        appAutoUpdateNotifier(UPDATE_INSTALLED_MESSAGE, 'success');
      }
    });
  }

  useEffect(()=>{
    if(uiReady) {
      pgAdmin?.Browser?.uiloaded?.();
    }
  }, [uiReady]);

  if(isLoading) {
    return <></>;
  }
  if(failed) {
    return <>Failed to load preferences</>;
  }

  return (
    <PgAdminProvider value={pgAdmin}>
      <WorkspaceProvider>
        <ModalProvider>
          <NotifierProvider pgAdmin={pgAdmin} pgWindow={pgWindow} onReady={()=>setUiReady(true)}/>
          {browser != 'Electron' && <AppMenuBar />}
          <Layouts browser={browser} />
        </ModalProvider>
        <ObjectBreadcrumbs pgAdmin={pgAdmin} />
      </WorkspaceProvider>
    </PgAdminProvider>
  );
}

BrowserComponent.propTypes = {
  pgAdmin: PropTypes.object,
};
