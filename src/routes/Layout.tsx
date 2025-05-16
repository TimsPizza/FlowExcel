import { FC } from "react";
import { Link, Outlet } from "react-router-dom";

const Layout: FC = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-800">Excel 处理器</h1>
        </div>
        <nav className="mt-4">
          <Link
            to="/"
            className="block px-4 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            开始
          </Link>
          <div className="mt-2">
            <div className="px-4 py-2 text-sm font-medium text-gray-500">
              数据处理
            </div>
            <Link
              to="/config"
              className="block px-6 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              数据源配置
            </Link>
            <Link
              to="/rules"
              className="block px-6 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              处理规则
            </Link>
            <Link
              to="/process"
              className="block px-6 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              执行处理
            </Link>
          </div>
          <Link
            to="/settings"
            className="mt-2 block px-4 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            设置
          </Link>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
