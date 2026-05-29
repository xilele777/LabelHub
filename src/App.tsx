import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import router from './router';
import AppErrorBoundary from './components/AppErrorBoundary';

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AppErrorBoundary>
        <RouterProvider router={router} />
      </AppErrorBoundary>
    </ConfigProvider>
  );
}
