import { CustomerMapView } from "@/components/customer-map-view"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-2 sm:p-4">
        <div className="mb-2 sm:mb-4 md:mb-6">
          <div className="flex items-center justify-between flex-col sm:flex-row gap-2 sm:gap-0">
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">Customer Address Management</h1>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground hidden sm:block">View and manage customer address information on the map</p>
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
