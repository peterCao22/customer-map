"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { GoogleMap, type GoogleMapRef } from "./google-map"
import { CustomerSearch } from "./customer-search"
import { CustomerList } from "./customer-list"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Filter, RotateCcw, MapPin, RefreshCw } from "lucide-react"

// 后端API返回的原始数据结构
interface CustomerDirectoryResponse {
  id: number
  customer_id: string
  customer_name: string
  address_id: string
  country: string
  country_db?: string
  address_line1: string
  address_line2?: string
  zip_code: string
  city: string
  state: string
  full_address: string
  full_description?: string
  tags: string[]
  sales_radius?: number
  lat?: number
  lng?: number
  total_amount?: number | null
}

// 前端使用的客户数据类型（转换后的结构）
export interface Customer {
  id: string
  companyName: string // 公司名称（来自后端customer_name）
  email: string       // 占位邮箱（基于公司名生成）
  phone: string       // 占位手机号（数据库中没有此字段）
  address: string     // 完整地址
  lat: number         // 纬度
  lng: number         // 经度
  tags: string[]      // 客户标签
  createdAt: Date     // 占位创建时间（数据库中没有此字段）
  salesRadius?: number // 销售范围半径（公里）
  totalAmount: number | null // 客户销售总额（来自后端total_amount）
  
  // 额外的后端字段（用于详细信息显示）
  customerId: string  // 客户ID
  addressId: string   // 地址ID
  country: string     // 国家
  city: string        // 城市
  state: string       // 州/省
  zipCode: string     // 邮政编码
}

// 数据转换函数：将后端数据转换为前端格式
const transformCustomerData = (apiData: CustomerDirectoryResponse): Customer => {
  // 生成基于公司名的邮箱（移除特殊字符）
  const cleanCompanyName = apiData.customer_name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // 移除所有非字母数字字符
    .substring(0, 20) // 限制长度避免邮箱过长
  
  return {
    id: apiData.id.toString(),
    companyName: apiData.customer_name, // 公司名称（直接来自customer_name）
    email: `未提供`, // 基于公司名生成占位邮箱
    phone: "未提供",                   // 数据库中没有电话字段
    address: apiData.full_address,    // 完整地址
    lat: apiData.lat || 0,           // 纬度坐标
    lng: apiData.lng || 0,           // 经度坐标
    tags: apiData.tags || [],        // 客户标签数组
    createdAt: new Date(),           // 占位创建时间
    salesRadius: apiData.sales_radius || 10, // 销售范围半径
    totalAmount: apiData.total_amount ?? null, // 客户销售总额
    
    // 后端原始字段（用于详细信息）
    customerId: apiData.customer_id,  // 客户业务ID
    addressId: apiData.address_id,    // 地址业务ID
    country: apiData.country,         // 国家
    city: apiData.city,              // 城市
    state: apiData.state,            // 州/省
    zipCode: apiData.zip_code,       // 邮政编码
  }
}

// API基础配置 - 动态获取当前主机IP
const API_BASE_URL = typeof window !== 'undefined' 
  ? `http://${window.location.hostname}:8000/api`
  : "http://localhost:8000/api"

// 注意：不再使用排除客户ID列表，改为基于STRATEGIC ACCOUNTS标签过滤

// API调用函数 - 自动分页获取所有数据
const fetchCustomers = async (maxRecords: number = 1000): Promise<Customer[]> => {
  try {
    const allCustomers: Customer[] = []
    const pageSize = 100 // 后端最大限制
    let currentPage = 1
    let hasMore = true
    
    while (hasMore && allCustomers.length < maxRecords) {
      const response = await fetch(`${API_BASE_URL}/customers?page=${currentPage}&page_size=${pageSize}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const transformedItems = data.items.map(transformCustomerData).filter((customer: Customer) => {
        // 过滤没有坐标的地址
        return customer.lat !== 0 && customer.lng !== 0
      })
      
      allCustomers.push(...transformedItems)
      
      // 检查是否还有更多数据
      hasMore = data.page < data.total_pages && transformedItems.length === pageSize
      currentPage++
      
      // 避免无限循环
      if (currentPage > 20) break // 最多20页，防止意外情况
    }
    
    return allCustomers
  } catch (error) {
    console.error('获取客户数据失败:', error)
    throw error
  }
}

// 搜索客户的API调用 - 支持自动分页
const searchCustomers = async (query?: string, tags?: string[]): Promise<Customer[]> => {
  try {
    const allResults: Customer[] = []
    const pageSize = 100 // 后端最大限制
    let currentPage = 1
    let hasMore = true
    
    while (hasMore && allResults.length < 500) { // 搜索结果最多500条
      const params = new URLSearchParams()
      if (query) params.append('query', query)
      if (tags && tags.length > 0) {
        tags.forEach(tag => params.append('tags', tag))
      }
      params.append('page', currentPage.toString())
      params.append('page_size', pageSize.toString())
      
      const response = await fetch(`${API_BASE_URL}/customers/search?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const transformedItems = data.items.map(transformCustomerData).filter((customer: Customer) => {
        // 过滤没有坐标的地址
        return customer.lat !== 0 && customer.lng !== 0
      })
      
      allResults.push(...transformedItems)
      
      // 检查是否还有更多数据
      hasMore = data.page < data.total_pages && transformedItems.length === pageSize
      currentPage++
      
      // 避免无限循环
      if (currentPage > 10) break // 搜索最多10页
    }
    
    return allResults
  } catch (error) {
    console.error('搜索客户数据失败:', error)
    throw error
  }
}

export function CustomerMapView() {
  const mapRef = useRef<GoogleMapRef>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showSidebar, setShowSidebar] = useState(true)
  const [showSalesRange, setShowSalesRange] = useState(false)
  const [showStrategicOnly, setShowStrategicOnly] = useState(false) // 战略客户筛选
  
  // 加载状态
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // 获取所有标签
  const allTags = Array.from(new Set(customers.flatMap((customer) => customer.tags)))

  // 加载客户数据
  const loadCustomers = useCallback(async () => {
    try {
      setError(null)
      // 加载所有有效的客户数据
      const data = await fetchCustomers(500) // 减少初始加载量，提高速度
      setCustomers(data)
      
      // 根据战略客户筛选状态应用过滤
      if (showStrategicOnly) {
        // 勾选状态：只显示有STRATEGIC ACCOUNTS标签的客户
        const strategicCustomers = data.filter(customer => {
          const tags = customer.tags
          return Array.isArray(tags) && tags.includes('STRATEGIC ACCOUNTS')
        })
        

        setFilteredCustomers(strategicCustomers)
      } else {
        // 默认状态：只显示tags为空数组的客户（对应数据库中tags IS NULL）
        const nonStrategicCustomers = data.filter(customer => {
          const tags = customer.tags
          // 只显示空标签数组的客户（对应数据库中的NULL）
          return Array.isArray(tags) && tags.length === 0
        })
        

        setFilteredCustomers(nonStrategicCustomers)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载客户数据失败')
      console.error('加载客户数据失败:', err)
    } finally {
      setLoading(false)
    }
  }, [showStrategicOnly]) // 当战略客户筛选状态改变时重新加载数据

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadCustomers()
    } finally {
      setRefreshing(false)
    }
  }, [loadCustomers])

  // 执行搜索（使用后端API搜索更精确）
  const performSearch = useCallback(async () => {
    if (!searchQuery && selectedTags.length === 0) {
      // 没有文本搜索和标签搜索时，使用本地筛选（处理战略客户筛选）
      filterCustomersLocally()
      return
    }

    try {
      setError(null)
      // 执行搜索
      let searchResults = await searchCustomers(searchQuery || undefined, selectedTags)
      
      // 应用战略客户筛选（在搜索结果基础上）
      if (showStrategicOnly) {
        // 勾选状态：只显示有STRATEGIC ACCOUNTS标签的客户
        searchResults = searchResults.filter(customer => {
          const tags = customer.tags
          return Array.isArray(tags) && tags.includes('STRATEGIC ACCOUNTS')
        })
      } else {
        // 默认状态：只显示tags为空数组的客户（对应数据库中tags IS NULL）
        searchResults = searchResults.filter(customer => {
          const tags = customer.tags
          return Array.isArray(tags) && tags.length === 0
        })
      }
      
      setFilteredCustomers(searchResults)
    } catch (err) {
      setError('搜索失败，显示本地结果')
      // 发生错误时回退到本地过滤
      filterCustomersLocally()
    }
  }, [searchQuery, selectedTags, showStrategicOnly, customers])

  // 本地过滤（作为后备方案）
  const filterCustomersLocally = useCallback(() => {
    let filtered = customers

    // 按搜索查询过滤
    if (searchQuery) {
      filtered = filtered.filter(
        (customer) =>
          customer.customerId.toLowerCase().includes(searchQuery.toLowerCase()) ||  // 使用业务客户ID (如C0047)
          customer.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.address.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // 按标签过滤
    if (selectedTags.length > 0) {
      filtered = filtered.filter((customer) => selectedTags.some((tag) => customer.tags.includes(tag)))
    }

    // 按战略客户筛选
    if (showStrategicOnly) {
      // 勾选状态：只显示有STRATEGIC ACCOUNTS标签的客户
      filtered = filtered.filter(customer => {
        const tags = customer.tags
        return Array.isArray(tags) && tags.includes('STRATEGIC ACCOUNTS')
      })
    } else {
      // 默认状态：只显示tags为空数组的客户（对应数据库中tags IS NULL）
      filtered = filtered.filter(customer => {
        const tags = customer.tags
        return Array.isArray(tags) && tags.length === 0
      })
    }

    setFilteredCustomers(filtered)
  }, [customers, searchQuery, selectedTags, showStrategicOnly])

  // 初始加载
  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  // 当战略客户筛选状态改变时，重新加载数据（如果需要包含所有数据）
  useEffect(() => {
    if (customers.length > 0) { // 只有在已有数据时才重新加载
      loadCustomers()
    }
  }, [showStrategicOnly, loadCustomers])

  // 当customers数据更新时（数据加载完成后），重新执行搜索以保持过滤状态
  useEffect(() => {
    if (customers.length > 0 && (searchQuery || selectedTags.length > 0 || showStrategicOnly)) {
      performSearch()
    }
  }, [customers.length]) // 当数据加载完成时触发

  // 搜索防抖
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch()
    }, 500) // 500ms 防抖

    return () => clearTimeout(debounceTimer)
  }, [performSearch])

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
  }

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleStrategicToggle = (checked: boolean) => {
    setShowStrategicOnly(checked)
  }

  const handleResetView = () => {
    mapRef.current?.resetView()
    setSelectedCustomer(null)
  }

  // 如果正在初始加载，显示加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">正在加载客户数据...</p>
        </div>
      </div>
    )
  }

  // 顶部控制按钮组件
  const topControls = (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleRefresh} 
        disabled={refreshing}
        title="刷新客户数据"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        刷新数据
      </Button>
      <Button variant="outline" size="sm" onClick={handleResetView} title="重置视图显示所有客户">
        <RotateCcw className="h-4 w-4" />
        重置视图
      </Button>
      <Button
        variant={showSalesRange ? "default" : "outline"}
        size="sm"
        onClick={() => setShowSalesRange(!showSalesRange)}
        title="显示/隐藏销量区域"
      >
        <MapPin className="h-4 w-4" />
        销量区域
      </Button>
    </>
  )

  return (
    <>
      {/* 将控制按钮渲染到页面顶部 */}
      {typeof window !== "undefined" && 
        createPortal(topControls, document.getElementById("map-controls") as HTMLElement)
      }
      
      <div className="flex gap-4 h-[calc(100vh-200px)]">
      {/* 侧边栏 */}
      {showSidebar && (
        <div className="w-80 flex flex-col gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                客户列表
                {refreshing && <RefreshCw className="h-4 w-4 animate-spin" />}
              </h2>
              <div className="text-sm text-muted-foreground">
                {searchQuery || selectedTags.length > 0 || showStrategicOnly
                  ? `${filteredCustomers.length} / ${customers.length}`
                  : `显示 ${filteredCustomers.length} 个客户地址`}
                {showStrategicOnly && (
                  <span className="ml-2 text-blue-600 font-medium">
                    (仅战略客户)
                  </span>
                )}
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <CustomerSearch
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedTags={selectedTags}
              allTags={allTags}
              onTagToggle={handleTagToggle}
              showStrategicOnly={showStrategicOnly}
              onStrategicToggle={handleStrategicToggle}
            />
          </Card>

          <Card className="flex-1 overflow-hidden">
            <CustomerList
              customers={filteredCustomers}
              selectedCustomer={selectedCustomer}
              onCustomerSelect={handleCustomerSelect}
            />
          </Card>
        </div>
      )}

      {/* 地图区域 */}
      <div className="flex-1 relative">
        <Card className="h-full">
          <div className="absolute top-4 left-4 z-10">
            <Button variant="outline" size="sm" onClick={() => setShowSidebar(!showSidebar)}>
              <Filter className="h-4 w-4" />
              {showSidebar ? "隐藏" : "显示"}侧边栏
            </Button>
          </div>

          <GoogleMap
            ref={mapRef}
            customers={filteredCustomers}
            selectedCustomer={selectedCustomer}
            onCustomerSelect={handleCustomerSelect}
            showSalesRange={showSalesRange}
          />
        </Card>
      </div>
    </div>
    </>
  )
}
