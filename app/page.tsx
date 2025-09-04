import { CustomerMapView } from "@/components/customer-map-view"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">客户地址管理</h1>
              <p className="text-muted-foreground">在地图上查看和管理客户地址信息</p>
            </div>
            <div className="flex gap-2" id="map-controls">
              {/* 按钮将通过 CustomerMapView 组件动态插入到这里 */}
            </div>
          </div>
        </div>
        <CustomerMapView />
      </div>
    </div>
  )
}
