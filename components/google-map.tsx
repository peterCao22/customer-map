"use client"

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react"
import type { Customer } from "./customer-map-view"

interface GoogleMapProps {
  customers: Customer[]
  selectedCustomer: Customer | null
  onCustomerSelect: (customer: Customer) => void
  showSalesRange?: boolean // 添加显示销售范围的prop
}

export interface GoogleMapRef {
  resetView: () => void
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export const GoogleMap = forwardRef<GoogleMapRef, GoogleMapProps>(
  ({ customers, selectedCustomer, onCustomerSelect, showSalesRange = false }, ref) => {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])
    const circlesRef = useRef<any[]>([]) // 添加圆形覆盖层引用
    const infoWindowRef = useRef<any>(null)
    const statePolygonsRef = useRef<any[]>([]) // 添加州级多边形覆盖层引用
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentZoom, setCurrentZoom] = useState(5) // 当前缩放级别
    const [usePolygonFallback, setUsePolygonFallback] = useState(false) // 是否使用Polygon降级方案

    // 检测硬件加速是否可用（Boot Camp兼容性检测）
    const checkHardwareAcceleration = () => {
      try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        
        if (!gl) return false
        
        const webglContext = gl as WebGLRenderingContext
        const debugInfo = webglContext.getExtension('WEBGL_debug_renderer_info')
        if (!debugInfo) return false
        
        const renderer = webglContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        const vendor = webglContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        
        // 检测是否为软件渲染
        const isSoftwareRendering = (
          renderer?.includes('Software') ||
          renderer?.includes('SwiftShader') ||
          renderer?.includes('Mesa') ||
          vendor?.includes('Software')
        )
        
        console.log('🔍 WebGL检测结果:', { renderer, vendor, isSoftwareRendering })
        
        return !isSoftwareRendering
      } catch (error) {
        console.warn('WebGL检测失败:', error)
        return false
      }
    }

    // 根据销售量获取标记颜色
    const getColorByAmount = (totalAmount: number | null) => {
      if (!totalAmount || totalAmount <= 0) return "#6b7280" // 灰色（无销售数据/销售量为0）
      return "#3b82f6" // 蓝色（有销售数据）
    }

    // 根据客户销售量计算标记圆圈大小
    const getMarkerSizeByAmount = (totalAmount: number | null, maxAmount: number) => {
      if (!totalAmount || totalAmount <= 0) return 10 // 最小半径（无销售数据/销售量为0）
      
      const minSize = 7   // 最小圆圈半径（低销售量）  
      const maxSize = 35  // 最大圆圈半径（高销售量）- 增加最大值使差异更明显
      
      const ratio = Math.min(totalAmount / maxAmount, 1)
      const calculatedSize = Math.round(minSize + ratio * (maxSize - minSize))
      
      
      return calculatedSize
    }

    // 创建可变大小的销售标记SVG
    const createSalesBasedMarker = (color: string, radius: number, isSelected: boolean = false) => {
      const size = radius * 2 + 10 // SVG总大小（留足边距）
      const strokeColor = isSelected ? "#ef4444" : "white"
      const strokeWidth = isSelected ? 4 : 2
      const centerDotSize = Math.max(2, Math.min(6, radius / 4)) // 中心点大小随圆圈调整
      
      const svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/><circle cx="${size/2}" cy="${size/2}" r="${centerDotSize}" fill="white"/></svg>`
      
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent)}`
    }

    // 美国各州人口数据（2020年人口普查）
    const STATE_POPULATION_DATA: { [stateAbbr: string]: number } = {
      "CA": 39538223, // 加利福尼亚州
      "TX": 29145505, // 德克萨斯州
      "FL": 21538187, // 佛罗里达州
      "NY": 20201249, // 纽约州
      "PA": 13002700, // 宾夕法尼亚州
      "IL": 12812508, // 伊利诺伊州
      "OH": 11799448, // 俄亥俄州
      "GA": 10711908, // 乔治亚州
      "NC": 10439388, // 北卡罗来纳州
      "MI": 10037261, // 密歇根州
      "NJ": 9288994,  // 新泽西州
      "VA": 8631393,  // 弗吉尼亚州
      "WA": 7705281,  // 华盛顿州
      "AZ": 7151502,  // 亚利桑那州
      "MA": 7001399,  // 马萨诸塞州
      "TN": 6910840,  // 田纳西州
      "IN": 6785528,  // 印第安纳州
      "MO": 6196515,  // 密苏里州
      "MD": 6177224,  // 马里兰州
      "WI": 5893718,  // 威斯康星州
      "CO": 5773714,  // 科罗拉多州
      "MN": 5737915,  // 明尼苏达州
      "SC": 5118425,  // 南卡罗来纳州
      "AL": 5024279,  // 阿拉巴马州
      "LA": 4657757,  // 路易斯安那州
      "KY": 4505836,  // 肯塔基州
      "OR": 4237256,  // 俄勒冈州
      "OK": 3959353,  // 俄克拉荷马州
      "CT": 3605944,  // 康涅狄格州
      "UT": 3271616,  // 犹他州
      "IA": 3190369,  // 爱荷华州
      "NV": 3104614,  // 内华达州
      "AR": 3011524,  // 阿肯色州
      "MS": 2961279,  // 密西西比州
      "KS": 2937880,  // 堪萨斯州
      "NM": 2117522,  // 新墨西哥州
      "NE": 1961504,  // 内布拉斯加州
      "ID": 1839106,  // 爱达荷州
      "WV": 1793716,  // 西弗吉尼亚州
      "HI": 1455271,  // 夏威夷州
      "NH": 1377529,  // 新罕布什尔州
      "ME": 1362359,  // 缅因州
      "RI": 1097379,  // 罗德岛州
      "MT": 1084225,  // 蒙大拿州
      "DE": 989948,   // 特拉华州
      "SD": 886667,   // 南达科他州
      "ND": 779094,   // 北达科他州
      "AK": 733391,   // 阿拉斯加州
      "VT": 643077,   // 佛蒙特州
      "WY": 576851,   // 怀俄明州
      "DC": 689545,   // 华盛顿特区
    }

    // 根据人口数量获取州级颜色（仅美国州按人口着色）
    const getStatePopulationColor = (stateAbbr: string) => {
      // 检查是否为美国州（在人口数据中存在）
      const population = STATE_POPULATION_DATA[stateAbbr]
      
      if (!population || population === 0) {
        // 非美国州或无人口数据，使用透明色（保持地图默认）
        console.log(`🌍 非美国地区 ${stateAbbr}: 使用透明色（地图默认）`)
        return 'transparent' // 透明色（加拿大省份等保持地图默认）
      }
      
      console.log(`🇺🇸 美国州 ${stateAbbr}: 人口 ${population.toLocaleString()}`)
      
      const maxPopulation = Math.max(...Object.values(STATE_POPULATION_DATA)) // 约3950万（CA）
      const intensity = population / maxPopulation
      
      // 增强的黄橙色系渐变：从象牙白到深橙色，对比更明显
      if (intensity >= 0.8) return '#CC6600' // 深橙色（人口最多：CA, TX, FL, NY）
      if (intensity >= 0.6) return '#FF7F00' // 橙色（人口较多：PA, IL, OH, GA）
      if (intensity >= 0.4) return '#FFA500' // 亮橙色（人口中等：NC, MI, NJ, VA）
      if (intensity >= 0.2) return '#FFD700' // 金色（人口较少：WA, AZ, MA等）
      if (intensity >= 0.1) return '#FFFF99' // 浅黄色（人口更少）
      return '#FFFACD'                       // 柠檬绸（人口最少：WY, VT, AK等）
    }

    // 根据客户数量获取州级热力图颜色（增强版本 - 更深的颜色）
    const getStateHeatColor = (customerCount: number, maxCount: number) => {
      if (customerCount === 0) return '#ffffff' // 白色（不显示）
      const intensity = customerCount / maxCount
      
      // 增强的颜色映射 - 让高值更深，与正常版本完全匹配
      if (intensity >= 0.9) return '#8B0000'  // 深红色 - 最高客户数 (暗红)
      if (intensity >= 0.8) return '#B22222'  // 火砖红 - 很高客户数
      if (intensity >= 0.7) return '#DC143C'  // 深红色 - 高客户数  
      if (intensity >= 0.6) return '#FF4500'  // 橙红色 - 较高客户数
      if (intensity >= 0.5) return '#FF6347'  // 番茄红 - 中上客户数
      if (intensity >= 0.4) return '#FF7F00'  // 深橙色 - 中等客户数
      if (intensity >= 0.3) return '#FFA500'  // 橙色 - 中等客户数
      if (intensity >= 0.2) return '#FFD700'  // 金色 - 较少客户数
      if (intensity >= 0.1) return '#FFFF99'  // 浅黄色 - 少客户数
      return '#FFFACD' // 柠檬绸色 - 最少客户数
    }

    // 检查环境变量配置
    const checkEnvironmentConfig = () => {
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      
    }

    // 根据客户州分组统计
    const getCustomersByState = () => {
      const stateStats = new Map<string, number>()
      customers.forEach(customer => {
        const state = customer.state?.trim()
        if (state && state.length === 2) { // 美国州缩写都是2个字母
          stateStats.set(state, (stateStats.get(state) || 0) + 1)
        }
      })
      return stateStats
    }

    // 使用Place ID API获取准确边界（与正常模式一致）
    const tryPlaceIdApproach = async (stateStats: Map<string, number>, maxCount: number) => {
      try {
        if (!window.google.maps.Geocoder) {
          console.log('❌ Geocoder API不可用')
          return false
        }

        console.log('🔍 使用Place ID和Geocoding API...')
        const geocoder = new window.google.maps.Geocoder()

        // 复用正常模式的Place ID映射
        const placeIdToStateMap: { [placeId: string]: string } = {
          "ChIJdf5LHzR_hogR6czIUzU0VV4": "AL", "ChIJG8CuwJzfAFQRNduKqSde27w": "AK", 
          "ChIJaxhMy-sIK4cRcc3Bf7EnOUI": "AZ", "ChIJYSc_dD-e0ocR0NLf_z5pBaQ": "AR",
          "ChIJPV4oX_65j4ARVW8IJ6IJUYs": "CA", "ChIJt1YYm3QUQIcR_6eQSTGDVMc": "CO",
          "ChIJpVER8hFT5okR5XBhBVttmq4": "CT", "ChIJO9YMTXYFx4kReOgEjBItHZQ": "DE",
          "ChIJvypWkWV2wYgR0E7HW9MTLvc": "FL", "ChIJV4FfHcU28YgR5xBP7BC8hGY": "GA",
          "ChIJGSZubzgtC4gRVlkRZFCCFX8": "IL", "ChIJHRv42bxQa4gRcuwyy84vEH4": "IN",
          "ChIJ35Dx6etNtokRsfZVdmU3r_I": "MD", "ChIJ_b9z6W1l44kRHA2DVTbQxkU": "MA",
          "ChIJEQTKxz2qTE0Rs8liellI3Zc": "MI", "ChIJmwt4YJpbWE0RD6L-EJvJogI": "MN",
          "ChIJn0AAnpX7wIkRjW0_-Ad70iw": "NJ", "ChIJqaUj8fBLzEwRZ5UY3sHGz90": "NY",
          "ChIJgRo4_MQfVIgRGa4i6fUwP60": "NC", "ChIJwY5NtXrpNogRFtmfnDlkzeU": "OH",
          "ChIJieUyHiaALYgRPbQiUEchRsI": "PA", "ChIJA8-XniNLYYgRVpGBpcEgPgM": "TN",
          "ChIJSTKCCzZwQIYRPN4IGI8c6xY": "TX", "ChIJzbK8vXDWTIgRlaZGt0lBTsA": "VA",
          "ChIJ-bDD5__lhVQRuvNfbGh4QpQ": "WA", "ChIJr-OEkw_0qFIR1kmG-LjV1fI": "WI"
        }

        let successCount = 0

        // 为重要的州获取准确边界
        for (const [placeId, stateAbbr] of Object.entries(placeIdToStateMap)) {
          const isUSState = !!STATE_POPULATION_DATA[stateAbbr]
          if (!isUSState) continue

          try {
            const results = await new Promise<any>((resolve, reject) => {
              geocoder.geocode({ placeId }, (results: any, status: any) => {
                if (status === 'OK' && results?.[0]) resolve(results[0])
                else reject(new Error(`Place ID geocoding failed: ${status}`))
              })
            })

            if (results.geometry?.viewport) {
              const { viewport } = results.geometry
              const ne = viewport.getNorthEast()
              const sw = viewport.getSouthWest()
              
              // 创建准确的矩形边界
              const bounds = [
                { lat: ne.lat(), lng: sw.lng() }, // NW
                { lat: ne.lat(), lng: ne.lng() }, // NE  
                { lat: sw.lat(), lng: ne.lng() }, // SE
                { lat: sw.lat(), lng: sw.lng() }  // SW
              ]
              
              const polygon = new window.google.maps.Polygon({
                paths: bounds,
                strokeColor: '#000000',
                strokeOpacity: 0.9,
                strokeWeight: 1,
                fillColor: getStatePopulationColor(stateAbbr),
                fillOpacity: 0.8,
                map: mapInstanceRef.current,
                zIndex: 1
              })
              
              statePolygonsRef.current.push(polygon)

              // 添加客户标签
              const customerCount = stateStats.get(stateAbbr) || 0
              if (customerCount > 0) {
                const labelMarker = new window.google.maps.Marker({
                  position: { 
                    lat: (ne.lat() + sw.lat()) / 2, 
                    lng: (ne.lng() + sw.lng()) / 2 
                  },
                  map: mapInstanceRef.current,
                  icon: {
                    url: createLabelIcon(`${stateAbbr}: ${customerCount}`),
                    scaledSize: new window.google.maps.Size(80, 30),
                    anchor: new window.google.maps.Point(40, 15),
                  },
                  zIndex: 1000
                })
                statePolygonsRef.current.push(labelMarker)
              }

              // 点击事件
              polygon.addListener('click', () => {
                const population = STATE_POPULATION_DATA[stateAbbr] || 0
                const infoContent = `
                  <div style="padding: 8px; font-family: system-ui;">
                    <h3 style="margin: 0 0 8px 0; color: #1f2937;">${stateAbbr}州</h3>
                    <p style="margin: 0; color: #4b5563;">人口数量: ${population.toLocaleString()}</p>
                    <p style="margin: 4px 0 0 0; color: #6b7280;">客户数量: ${customerCount}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Boot Camp模式（Place ID准确边界）</p>
                  </div>
                `
                if (infoWindowRef.current) infoWindowRef.current.close()
                infoWindowRef.current = new window.google.maps.InfoWindow({ content: infoContent })
                infoWindowRef.current.open(mapInstanceRef.current)
              })

              successCount++
              console.log(`✅ ${stateAbbr}: 获取Place ID边界成功`)
              await new Promise(resolve => setTimeout(resolve, 100)) // 限制API频率
            }
          } catch (error) {
            console.log(`❌ ${stateAbbr}: Place ID失败 - ${error}`)
          }
        }

        // 处理非美国地区标签
        stateStats.forEach((count, region) => {
          if (!STATE_POPULATION_DATA[region] && count > 0) {
            const positions: any = { "ON": {lat: 50, lng: -85}, "QC": {lat: 53, lng: -70}, "BC": {lat: 54, lng: -125} }
            const pos = positions[region]
            if (pos) {
              const marker = new window.google.maps.Marker({
                position: pos,
                map: mapInstanceRef.current,
                icon: {
                  url: createLabelIcon(`${region}: ${count}`),
                  scaledSize: new window.google.maps.Size(80, 30),
                  anchor: new window.google.maps.Point(40, 15),
                },
                zIndex: 1000
              })
              statePolygonsRef.current.push(marker)
            }
          }
        })

        return successCount > 10 // 成功创建足够多的边界
      } catch (error) {
        console.error('❌ Place ID方法异常:', error)
        return false
      }
    }

    // 创建标签图标的辅助函数
    const createLabelIcon = (text: string) => {
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30">
          <rect x="2" y="2" width="76" height="26" fill="rgba(255,255,255,0.95)" 
                stroke="#333" stroke-width="2" rx="8"/>
          <text x="40" y="20" font-family="Arial, sans-serif" font-size="14" 
                font-weight="bold" fill="#333" text-anchor="middle">${text}</text>
        </svg>
      `
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent)}`
    }

    // 精确州边界降级方案：使用真实的州边界坐标数据
    const createPolygonStateOverlays = async () => {
      if (!mapInstanceRef.current || !window.google) return
      
      try {
        // 清除现有覆盖
        clearStateOverlays()
        
        const stateStats = getCustomersByState()
        const maxCount = Math.max(...Array.from(stateStats.values()), 1)
        
        console.log('🔄 Boot Camp兼容模式：尝试Place ID获取准确边界...')
        
        // 首先尝试使用Place ID API获取准确边界（与正常模式一致）
        const apiSuccess = await tryPlaceIdApproach(stateStats, maxCount)
        if (apiSuccess) {
          console.log('✅ 使用Place ID API获取准确边界成功')
          return
        }
        
        console.log('⚠️ Place ID API失败，使用预定义坐标...')
        
        // 精确的美国州边界坐标数据（简化但准确的多边形）
        const statePolygonData: { [stateAbbr: string]: { lat: number; lng: number }[] } = {
          "CA": [ // 加利福尼亚州 - 改进的边界形状
            { lat: 42.0, lng: -124.4 }, { lat: 42.0, lng: -120.0 }, { lat: 39.0, lng: -120.0 },
            { lat: 35.0, lng: -114.1 }, { lat: 32.5, lng: -114.1 }, { lat: 32.5, lng: -117.1 },
            { lat: 33.0, lng: -118.4 }, { lat: 34.4, lng: -120.6 }, { lat: 37.0, lng: -122.5 },
            { lat: 42.0, lng: -124.4 }
          ],
          "TX": [ // 德克萨斯州 - 改进的形状
            { lat: 36.5, lng: -103.0 }, { lat: 32.0, lng: -103.0 }, { lat: 31.5, lng: -106.5 },
            { lat: 29.5, lng: -103.0 }, { lat: 26.0, lng: -97.0 }, { lat: 25.8, lng: -93.5 },
            { lat: 29.0, lng: -93.5 }, { lat: 31.0, lng: -94.0 }, { lat: 33.8, lng: -94.0 },
            { lat: 36.5, lng: -100.0 }, { lat: 36.5, lng: -103.0 }
          ],
          "NY": [ // 纽约州 - L形状
            { lat: 45.0, lng: -74.0 }, { lat: 44.5, lng: -73.3 }, { lat: 43.6, lng: -73.3 },
            { lat: 42.0, lng: -73.3 }, { lat: 40.5, lng: -73.7 }, { lat: 40.5, lng: -74.2 },
            { lat: 40.9, lng: -74.9 }, { lat: 42.0, lng: -79.8 }, { lat: 43.0, lng: -79.0 },
            { lat: 45.0, lng: -74.7 }, { lat: 45.0, lng: -74.0 }
          ],
          "FL": [ // 佛罗里达州 - 半岛形状  
            { lat: 31.0, lng: -87.6 }, { lat: 31.0, lng: -85.0 }, { lat: 30.4, lng: -84.3 },
            { lat: 29.0, lng: -84.0 }, { lat: 28.0, lng: -82.7 }, { lat: 26.0, lng: -81.8 },
            { lat: 25.1, lng: -80.4 }, { lat: 25.8, lng: -80.0 }, { lat: 27.0, lng: -82.0 },
            { lat: 29.0, lng: -85.0 }, { lat: 30.7, lng: -87.6 }, { lat: 31.0, lng: -87.6 }
          ],
          "WA": [ // 华盛顿州
            { lat: 49.0, lng: -124.8 }, { lat: 49.0, lng: -117.0 }, { lat: 47.0, lng: -117.0 },
            { lat: 45.5, lng: -116.9 }, { lat: 45.5, lng: -124.2 }, { lat: 46.2, lng: -124.2 },
            { lat: 48.4, lng: -124.8 }, { lat: 49.0, lng: -124.8 }
          ],
          "IL": [ // 伊利诺伊州
            { lat: 42.5, lng: -87.0 }, { lat: 42.5, lng: -90.6 }, { lat: 40.6, lng: -91.5 },
            { lat: 37.0, lng: -89.2 }, { lat: 37.0, lng: -88.0 }, { lat: 38.8, lng: -87.5 },
            { lat: 41.8, lng: -87.5 }, { lat: 42.5, lng: -87.0 }
          ],
          "AZ": [ // 亚利桑那州
            { lat: 37.0, lng: -114.8 }, { lat: 37.0, lng: -109.0 }, { lat: 31.3, lng: -109.0 },
            { lat: 31.3, lng: -111.1 }, { lat: 32.7, lng: -114.8 }, { lat: 37.0, lng: -114.8 }
          ],
          "NV": [ // 内华达州  
            { lat: 42.0, lng: -120.0 }, { lat: 42.0, lng: -114.0 }, { lat: 37.0, lng: -114.0 },
            { lat: 35.0, lng: -114.6 }, { lat: 35.0, lng: -120.0 }, { lat: 39.0, lng: -120.0 },
            { lat: 42.0, lng: -120.0 }
          ],
          "UT": [ // 犹他州
            { lat: 42.0, lng: -114.0 }, { lat: 42.0, lng: -109.0 }, { lat: 37.0, lng: -109.0 },
            { lat: 37.0, lng: -114.0 }, { lat: 42.0, lng: -114.0 }
          ],
          "ID": [ // 爱达荷州 - 细长形状
            { lat: 49.0, lng: -117.2 }, { lat: 49.0, lng: -111.0 }, { lat: 44.0, lng: -111.0 },
            { lat: 42.0, lng: -111.0 }, { lat: 42.0, lng: -117.2 }, { lat: 45.8, lng: -116.9 },
            { lat: 49.0, lng: -117.2 }
          ],
          "MT": [ // 蒙大拿州
            { lat: 49.0, lng: -116.0 }, { lat: 49.0, lng: -104.0 }, { lat: 45.0, lng: -104.0 },
            { lat: 44.3, lng: -111.1 }, { lat: 45.0, lng: -116.0 }, { lat: 49.0, lng: -116.0 }
          ],
          "ND": [ // 北达科他州
            { lat: 49.0, lng: -104.0 }, { lat: 49.0, lng: -96.5 }, { lat: 45.9, lng: -96.5 },
            { lat: 45.9, lng: -104.0 }, { lat: 49.0, lng: -104.0 }
          ],
          "SD": [ // 南达科他州
            { lat: 45.9, lng: -104.0 }, { lat: 45.9, lng: -96.4 }, { lat: 42.5, lng: -96.4 },
            { lat: 42.5, lng: -104.0 }, { lat: 45.9, lng: -104.0 }
          ],
          "MN": [ // 明尼苏达州
            { lat: 49.0, lng: -95.2 }, { lat: 49.0, lng: -89.5 }, { lat: 46.7, lng: -89.5 },
            { lat: 43.5, lng: -91.2 }, { lat: 43.5, lng: -96.4 }, { lat: 45.9, lng: -96.5 },
            { lat: 49.0, lng: -95.2 }
          ],
          "WI": [ // 威斯康星州
            { lat: 47.1, lng: -92.9 }, { lat: 47.1, lng: -86.2 }, { lat: 45.0, lng: -86.0 },
            { lat: 42.5, lng: -87.8 }, { lat: 42.5, lng: -90.6 }, { lat: 43.8, lng: -92.9 },
            { lat: 47.1, lng: -92.9 }
          ],
          "IA": [ // 爱荷华州
            { lat: 43.5, lng: -96.6 }, { lat: 43.5, lng: -90.1 }, { lat: 40.4, lng: -90.1 },
            { lat: 40.4, lng: -96.6 }, { lat: 43.5, lng: -96.6 }
          ],
          "NE": [ // 内布拉斯加州
            { lat: 43.0, lng: -104.0 }, { lat: 43.0, lng: -95.3 }, { lat: 40.0, lng: -95.3 },
            { lat: 40.0, lng: -104.0 }, { lat: 43.0, lng: -104.0 }
          ],
          "KS": [ // 堪萨斯州
            { lat: 40.0, lng: -102.0 }, { lat: 40.0, lng: -94.6 }, { lat: 37.0, lng: -94.6 },
            { lat: 37.0, lng: -102.0 }, { lat: 40.0, lng: -102.0 }
          ],
          "MO": [ // 密苏里州 - 不规则形状
            { lat: 40.6, lng: -95.8 }, { lat: 40.6, lng: -89.1 }, { lat: 38.3, lng: -89.1 },
            { lat: 36.0, lng: -89.7 }, { lat: 36.0, lng: -94.6 }, { lat: 37.0, lng: -94.6 },
            { lat: 40.2, lng: -95.8 }, { lat: 40.6, lng: -95.8 }
          ],
          "OK": [ // 俄克拉荷马州  
            { lat: 37.0, lng: -103.0 }, { lat: 37.0, lng: -94.4 }, { lat: 33.6, lng: -94.4 },
            { lat: 33.6, lng: -103.0 }, { lat: 37.0, lng: -103.0 }
          ],
          "AR": [ // 阿肯色州
            { lat: 36.5, lng: -94.6 }, { lat: 36.5, lng: -89.6 }, { lat: 33.0, lng: -89.6 },
            { lat: 33.0, lng: -94.6 }, { lat: 36.5, lng: -94.6 }
          ],
          "LA": [ // 路易斯安那州 - boot形状
            { lat: 33.0, lng: -94.0 }, { lat: 33.0, lng: -91.2 }, { lat: 32.0, lng: -91.2 },
            { lat: 30.2, lng: -89.8 }, { lat: 29.0, lng: -89.4 }, { lat: 28.9, lng: -93.9 },
            { lat: 30.0, lng: -94.0 }, { lat: 33.0, lng: -94.0 }
          ],
          "MS": [ // 密西西比州
            { lat: 35.0, lng: -91.7 }, { lat: 35.0, lng: -88.1 }, { lat: 30.2, lng: -88.1 },
            { lat: 30.2, lng: -91.7 }, { lat: 35.0, lng: -91.7 }
          ],
          "AL": [ // 阿拉巴马州
            { lat: 35.0, lng: -88.5 }, { lat: 35.0, lng: -84.9 }, { lat: 30.2, lng: -84.9 },
            { lat: 30.2, lng: -88.5 }, { lat: 35.0, lng: -88.5 }
          ],
          "OH": [ // 俄亥俄州
            { lat: 41.9, lng: -84.8 }, { lat: 41.9, lng: -80.5 }, { lat: 40.6, lng: -80.5 },
            { lat: 38.4, lng: -82.6 }, { lat: 38.4, lng: -84.8 }, { lat: 39.1, lng: -84.8 },
            { lat: 41.9, lng: -84.8 }
          ],
          "PA": [ // 宾夕法尼亚州
            { lat: 42.0, lng: -80.5 }, { lat: 42.0, lng: -74.7 }, { lat: 39.7, lng: -75.8 },
            { lat: 39.7, lng: -80.5 }, { lat: 42.0, lng: -80.5 }
          ],
          "KY": [ // 肯塔基州
            { lat: 39.1, lng: -89.6 }, { lat: 39.1, lng: -81.9 }, { lat: 36.5, lng: -81.9 },
            { lat: 36.5, lng: -89.6 }, { lat: 39.1, lng: -89.6 }
          ],
          "TN": [ // 田纳西州
            { lat: 36.7, lng: -90.3 }, { lat: 36.7, lng: -81.6 }, { lat: 35.0, lng: -81.6 },
            { lat: 35.0, lng: -90.3 }, { lat: 36.7, lng: -90.3 }
          ],
          "NC": [ // 北卡罗来纳州
            { lat: 36.6, lng: -84.3 }, { lat: 36.6, lng: -75.4 }, { lat: 35.2, lng: -75.4 },
            { lat: 33.8, lng: -78.5 }, { lat: 35.0, lng: -84.3 }, { lat: 36.6, lng: -84.3 }
          ],
          "SC": [ // 南卡罗来纳州
            { lat: 35.2, lng: -83.4 }, { lat: 35.2, lng: -78.5 }, { lat: 32.0, lng: -78.9 },
            { lat: 32.0, lng: -83.4 }, { lat: 35.2, lng: -83.4 }
          ],
          "GA": [ // 乔治亚州
            { lat: 35.0, lng: -85.6 }, { lat: 35.0, lng: -80.8 }, { lat: 30.4, lng: -81.4 },
            { lat: 30.4, lng: -84.9 }, { lat: 32.0, lng: -85.6 }, { lat: 35.0, lng: -85.6 }
          ],
          "VA": [ // 弗吉尼亚州
            { lat: 39.5, lng: -83.7 }, { lat: 39.5, lng: -75.2 }, { lat: 36.5, lng: -75.9 },
            { lat: 36.5, lng: -83.7 }, { lat: 39.5, lng: -83.7 }
          ],
          "DC": [ // 华盛顿特区
            { lat: 38.99, lng: -77.12 }, { lat: 38.99, lng: -76.9 }, { lat: 38.8, lng: -76.9 },
            { lat: 38.8, lng: -77.12 }, { lat: 38.99, lng: -77.12 }
          ],
          "MI": [ // 密歇根州
            { lat: 48.2, lng: -90.4 }, { lat: 48.2, lng: -82.4 }, { lat: 41.7, lng: -82.4 },
            { lat: 41.7, lng: -87.0 }, { lat: 45.6, lng: -87.0 }, { lat: 47.1, lng: -88.0 },
            { lat: 48.2, lng: -90.4 }
          ],
          "IN": [ // 印第安纳州
            { lat: 41.8, lng: -88.1 }, { lat: 41.8, lng: -84.8 }, { lat: 37.8, lng: -84.8 },
            { lat: 37.8, lng: -88.1 }, { lat: 41.8, lng: -88.1 }
          ],
          "WV": [ // 西弗吉尼亚州
            { lat: 40.6, lng: -82.6 }, { lat: 40.6, lng: -77.7 }, { lat: 37.2, lng: -77.7 },
            { lat: 37.2, lng: -82.6 }, { lat: 40.6, lng: -82.6 }
          ],
          "MD": [ // 马里兰州
            { lat: 39.7, lng: -79.5 }, { lat: 39.7, lng: -75.0 }, { lat: 38.0, lng: -75.0 },
            { lat: 38.0, lng: -79.5 }, { lat: 39.7, lng: -79.5 }
          ],
          "NJ": [ // 新泽西州
            { lat: 41.4, lng: -75.6 }, { lat: 41.4, lng: -73.9 }, { lat: 38.9, lng: -74.9 },
            { lat: 38.9, lng: -75.6 }, { lat: 41.4, lng: -75.6 }
          ],
          "CT": [ // 康涅狄格州
            { lat: 42.1, lng: -73.7 }, { lat: 42.1, lng: -71.8 }, { lat: 40.9, lng: -71.8 },
            { lat: 40.9, lng: -73.7 }, { lat: 42.1, lng: -73.7 }
          ],
          "MA": [ // 马萨诸塞州
            { lat: 42.9, lng: -73.5 }, { lat: 42.9, lng: -69.9 }, { lat: 41.2, lng: -69.9 },
            { lat: 41.2, lng: -73.5 }, { lat: 42.9, lng: -73.5 }
          ],
          "RI": [ // 罗德岛州
            { lat: 42.0, lng: -71.9 }, { lat: 42.0, lng: -71.1 }, { lat: 41.1, lng: -71.1 },
            { lat: 41.1, lng: -71.9 }, { lat: 42.0, lng: -71.9 }
          ],
          "VT": [ // 佛蒙特州
            { lat: 45.0, lng: -73.4 }, { lat: 45.0, lng: -71.5 }, { lat: 42.7, lng: -71.5 },
            { lat: 42.7, lng: -73.4 }, { lat: 45.0, lng: -73.4 }
          ],
          "NH": [ // 新罕布什尔州
            { lat: 45.3, lng: -72.6 }, { lat: 45.3, lng: -70.6 }, { lat: 42.7, lng: -70.6 },
            { lat: 42.7, lng: -72.6 }, { lat: 45.3, lng: -72.6 }
          ],
          "ME": [ // 缅因州
            { lat: 47.5, lng: -71.1 }, { lat: 47.5, lng: -66.9 }, { lat: 43.1, lng: -66.9 },
            { lat: 43.1, lng: -71.1 }, { lat: 47.5, lng: -71.1 }
          ],
          // 加拿大省份支持
          "ON": [ // 安大略省
            { lat: 57.0, lng: -95.0 }, { lat: 57.0, lng: -74.3 }, { lat: 41.7, lng: -74.3 },
            { lat: 41.7, lng: -95.0 }, { lat: 57.0, lng: -95.0 }
          ],
          "QC": [ // 魁北克省
            { lat: 62.6, lng: -79.8 }, { lat: 62.6, lng: -57.1 }, { lat: 45.0, lng: -57.1 },
            { lat: 45.0, lng: -79.8 }, { lat: 62.6, lng: -79.8 }
          ],
          "BC": [ // 不列颠哥伦比亚省
            { lat: 60.0, lng: -139.1 }, { lat: 60.0, lng: -114.0 }, { lat: 48.3, lng: -114.0 },
            { lat: 48.3, lng: -139.1 }, { lat: 60.0, lng: -139.1 }
          ]
        }
        
        // 只为美国州创建多边形覆盖（复用正常模式逻辑）
        Object.keys(statePolygonData).forEach((stateAbbr) => {
          const polygonCoords = statePolygonData[stateAbbr]
          if (!polygonCoords) return
          
          // 只处理美国州，跳过非美国地区（加拿大等）
          const isUSState = !!STATE_POPULATION_DATA[stateAbbr]
          if (!isUSState) {
            console.log(`🌍 跳过非美国地区 ${stateAbbr}: 不创建颜色覆盖，使用地图默认`)
            return
          }
          
          console.log(`🇺🇸 创建美国州 ${stateAbbr} 的人口颜色覆盖`)
          
          // 只对美国州进行人口着色
          const fillColor = getStatePopulationColor(stateAbbr)
          
          // 创建多边形覆盖 - 增强不透明度让颜色更深
          const polygon = new window.google.maps.Polygon({
            paths: polygonCoords,
            strokeColor: '#000000', // 黑色边框
            strokeOpacity: 0.9,     // 增强边框不透明度
            strokeWeight: 1,
            fillColor: fillColor,
            fillOpacity: 0.85,      // 增强填充不透明度，让颜色更深
            map: mapInstanceRef.current,
            zIndex: 1
          })
          
          statePolygonsRef.current.push(polygon)
          
          // 获取该州的客户数量和人口数量
          const customerCount = stateStats.get(stateAbbr) || 0
          const population = STATE_POPULATION_DATA[stateAbbr] || 0
          
          // 添加点击事件
          polygon.addListener('click', (event: any) => {
            // 判断是否为加拿大省份
            const isCanadianProvince = ['ON', 'QC', 'BC'].includes(stateAbbr)
            const regionType = isCanadianProvince ? '省' : '州'
            const isUSState = !!STATE_POPULATION_DATA[stateAbbr]
            
            let infoContent = ''
            
            if (isUSState) {
              // 美国州：显示人口和客户信息
              infoContent = `
                <div style="padding: 8px; font-family: system-ui;">
                  <h3 style="margin: 0 0 8px 0; color: #1f2937;">${stateAbbr}${regionType}</h3>
                  <p style="margin: 0; color: #4b5563;">人口数量: ${population.toLocaleString()}</p>
                  <p style="margin: 4px 0 0 0; color: #6b7280;">客户数量: ${customerCount}</p>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Boot Camp兼容模式（按人口着色）</p>
                </div>
              `
            } else {
              // 非美国地区：只显示客户信息
              infoContent = `
                <div style="padding: 8px; font-family: system-ui;">
                  <h3 style="margin: 0 0 8px 0; color: #1f2937;">${stateAbbr}${regionType}</h3>
                  <p style="margin: 0; color: #6b7280;">客户数量: ${customerCount}</p>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Boot Camp兼容模式（统一颜色）</p>
                </div>
              `
            }
            
            if (infoWindowRef.current) {
              infoWindowRef.current.close()
            }
            
            infoWindowRef.current = new window.google.maps.InfoWindow({
              content: infoContent,
              position: event.latLng
            })
            
            infoWindowRef.current.open(mapInstanceRef.current)
          })
          
          // 计算多边形中心点用于标签显示
          const centerLat = polygonCoords.reduce((sum, coord) => sum + coord.lat, 0) / polygonCoords.length
          const centerLng = polygonCoords.reduce((sum, coord) => sum + coord.lng, 0) / polygonCoords.length
          
          // 创建小巧的SVG标签图标
          const createLabelIcon = (text: string) => {
            const svgContent = `
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30">
                <rect x="2" y="2" width="76" height="26" fill="rgba(255,255,255,0.95)" 
                      stroke="#333" stroke-width="2" rx="8"/>
                <text x="40" y="20" font-family="Arial, sans-serif" font-size="14" 
                      font-weight="bold" fill="#333" text-anchor="middle">${text}</text>
              </svg>
            `
            return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent)}`
          }
          
          // 显示客户数量标签（只有有客户的州才显示标签）
          if (customerCount > 0) {
            const labelMarker = new window.google.maps.Marker({
              position: { lat: centerLat, lng: centerLng },
              map: mapInstanceRef.current,
              icon: {
                url: createLabelIcon(`${stateAbbr}: ${customerCount}`),
                scaledSize: new window.google.maps.Size(80, 30),
                anchor: new window.google.maps.Point(40, 15),
              },
              zIndex: 1000 // 确保标签在最顶层
            })
            
            statePolygonsRef.current.push(labelMarker)
          }
        })
        
        // 为非美国地区只添加客户标签（不创建多边形覆盖）
        stateStats.forEach((customerCount, stateAbbr) => {
          const isUSState = !!STATE_POPULATION_DATA[stateAbbr]
          
          if (!isUSState && customerCount > 0) {
            console.log(`🏷️ 为非美国地区 ${stateAbbr} 添加客户标签（无颜色覆盖）`)
            
            const polygonCoords = statePolygonData[stateAbbr]
            if (polygonCoords) {
              // 计算多边形中心点用于标签显示
              const centerLat = polygonCoords.reduce((sum, coord) => sum + coord.lat, 0) / polygonCoords.length
              const centerLng = polygonCoords.reduce((sum, coord) => sum + coord.lng, 0) / polygonCoords.length
              
              // 创建小巧的SVG标签图标
              const createLabelIcon = (text: string) => {
                const svgContent = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 80 30">
                    <rect x="2" y="2" width="76" height="26" fill="rgba(255,255,255,0.95)" 
                          stroke="#333" stroke-width="2" rx="8"/>
                    <text x="40" y="20" font-family="Arial, sans-serif" font-size="14" 
                          font-weight="bold" fill="#333" text-anchor="middle">${text}</text>
                  </svg>
                `
                return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent)}`
              }
              
              // 只显示标签，不显示多边形
              const labelMarker = new window.google.maps.Marker({
                position: { lat: centerLat, lng: centerLng },
                map: mapInstanceRef.current,
                icon: {
                  url: createLabelIcon(`${stateAbbr}: ${customerCount}`),
                  scaledSize: new window.google.maps.Size(80, 30),
                  anchor: new window.google.maps.Point(40, 15),
                },
                zIndex: 1000 // 确保标签在最顶层
              })
              
              // 为标签添加点击事件
              labelMarker.addListener('click', (event: any) => {
                const isCanadianProvince = ['ON', 'QC', 'BC'].includes(stateAbbr)
                const regionType = isCanadianProvince ? '省' : '州'
                
                const infoContent = `
                  <div style="padding: 8px; font-family: system-ui;">
                    <h3 style="margin: 0 0 8px 0; color: #1f2937;">${stateAbbr}${regionType}</h3>
                    <p style="margin: 0; color: #6b7280;">客户数量: ${customerCount}</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Boot Camp兼容模式（使用地图默认颜色）</p>
                  </div>
                `
                
                if (infoWindowRef.current) {
                  infoWindowRef.current.close()
                }
                
                infoWindowRef.current = new window.google.maps.InfoWindow({
                  content: infoContent,
                  position: event.latLng
                })
                
                infoWindowRef.current.open(mapInstanceRef.current)
              })
              
              statePolygonsRef.current.push(labelMarker)
            }
          }
        })
        
        console.log(`✅ Boot Camp预定义坐标完成: ${statePolygonsRef.current.length} 个覆盖 (美国州有颜色，非美国地区仅标签)`)
        
      } catch (error) {
        console.error('❌ Polygon州边界创建失败:', error)
      }
    }

    // 创建州级Choropleth Map（按照官方文档实现）
    const createStateOverlays = async () => {
      if (!mapInstanceRef.current || !window.google) return
      
      // 检测硬件加速是否可用，如果不可用则使用Polygon降级方案
      const hasHardwareAcceleration = checkHardwareAcceleration()
      if (!hasHardwareAcceleration) {
        console.warn('⚠️ 硬件加速不可用，使用Polygon降级方案')
        setUsePolygonFallback(true)
        return createPolygonStateOverlays()
      }
      
      try {
        // 清除现有的州级覆盖
        clearStateOverlays()
        setUsePolygonFallback(false)

        const stateStats = getCustomersByState()
        const maxCount = Math.max(...Array.from(stateStats.values()), 1)
        


        // 检查FeatureLayer是否可用
        let featureLayer = null
        try {
          featureLayer = mapInstanceRef.current.getFeatureLayer("ADMINISTRATIVE_AREA_LEVEL_1")
        } catch (err) {
          throw new Error('FeatureLayer not configured in Map Style')
        }
        
        // 创建客户数据映射（用于样式设置）
        const stateCustomerData: { [stateAbbr: string]: number } = {}
        stateStats.forEach((count, stateAbbr) => {
          stateCustomerData[stateAbbr] = count
        })

        // 设置州边界样式（复用正常模式，但改为按人口着色）
                  featureLayer.style = (options: any) => {
            const feature = options.feature
            
            // 使用 Place ID 匹配人口数据（复用正常模式逻辑）
            const placeId = feature.placeId
            
            console.log('🎯 FeatureLayer样式设置 - PlaceID:', placeId)
            
            // 美国各州的 Place ID 到缩写映射（使用官方示例的精确 Place ID）
            const placeIdToStateMap: { [placeId: string]: string } = {
              "ChIJdf5LHzR_hogR6czIUzU0VV4": "AL", // Alabama
              "ChIJG8CuwJzfAFQRNduKqSde27w": "AK", // Alaska
              "ChIJaxhMy-sIK4cRcc3Bf7EnOUI": "AZ", // Arizona
              "ChIJYSc_dD-e0ocR0NLf_z5pBaQ": "AR", // Arkansas
              "ChIJPV4oX_65j4ARVW8IJ6IJUYs": "CA", // California
              "ChIJt1YYm3QUQIcR_6eQSTGDVMc": "CO", // Colorado
              "ChIJpVER8hFT5okR5XBhBVttmq4": "CT", // Connecticut
              "ChIJO9YMTXYFx4kReOgEjBItHZQ": "DE", // Delaware
              "ChIJvypWkWV2wYgR0E7HW9MTLvc": "FL", // Florida
              "ChIJV4FfHcU28YgR5xBP7BC8hGY": "GA", // Georgia
              "ChIJBeB5Twbb_3sRKIbMdNKCd0s": "HI", // Hawaii
              "ChIJ6Znkhaj_WFMRWIf3FQUwa9A": "ID", // Idaho
              "ChIJGSZubzgtC4gRVlkRZFCCFX8": "IL", // Illinois
              "ChIJHRv42bxQa4gRcuwyy84vEH4": "IN", // Indiana
              "ChIJGWD48W9e7ocR2VnHV0pj78Y": "IA", // Iowa
              "ChIJawF8cXEXo4cRXwk-S6m0wmg": "KS", // Kansas
              "ChIJyVMZi0xzQogR_N_MxU5vH3c": "KY", // Kentucky
              "ChIJZYIRslSkIIYRA0flgTL3Vck": "LA", // Louisiana
              "ChIJ1YpTHd4dsEwR0KggZ2_MedY": "ME", // Maine
              "ChIJ35Dx6etNtokRsfZVdmU3r_I": "MD", // Maryland
              "ChIJ_b9z6W1l44kRHA2DVTbQxkU": "MA", // Massachusetts
              "ChIJEQTKxz2qTE0Rs8liellI3Zc": "MI", // Michigan
              "ChIJmwt4YJpbWE0RD6L-EJvJogI": "MN", // Minnesota
              "ChIJGdRK5OQyKIYR2qbc6X8XDWI": "MS", // Mississippi
              "ChIJfeMiSNXmwIcRcr1mBFnEW7U": "MO", // Missouri
              "ChIJ04p7LZwrQVMRGGwqz1jWcfU": "MT", // Montana
              "ChIJ7fwMtciNk4cRxArzDwyQJ6E": "NE", // Nebraska
              "ChIJcbTe-KEKmYARs5X8qooDR88": "NV", // Nevada
              "ChIJ66bAnUtEs0wR64CmJa8CyNc": "NH", // New Hampshire
              "ChIJn0AAnpX7wIkRjW0_-Ad70iw": "NJ", // New Jersey
              "ChIJqVKY50NQGIcRup41Yxpuv0Y": "NM", // New Mexico
              "ChIJqaUj8fBLzEwRZ5UY3sHGz90": "NY", // New York
              "ChIJgRo4_MQfVIgRGa4i6fUwP60": "NC", // North Carolina
              "ChIJY-nYVxKD11IRyc9egzmahA0": "ND", // North Dakota
              "ChIJwY5NtXrpNogRFtmfnDlkzeU": "OH", // Ohio
              "ChIJnU-ssRE5rIcRSOoKQDPPHF0": "OK", // Oklahoma
              "ChIJVWqfm3xuk1QRdrgLettlTH0": "OR", // Oregon
              "ChIJieUyHiaALYgRPbQiUEchRsI": "PA", // Pennsylvania
              "ChIJD9cOYhQ15IkR5wbB57wYTh4": "RI", // Rhode Island
              "ChIJ49ExeWml-IgRnhcF9TKh_7k": "SC", // South Carolina
              "ChIJpTjphS1DfYcRt6SGMSnW8Ac": "SD", // South Dakota
              "ChIJA8-XniNLYYgRVpGBpcEgPgM": "TN", // Tennessee
              "ChIJSTKCCzZwQIYRPN4IGI8c6xY": "TX", // Texas
              "ChIJzfkTj8drTIcRP0bXbKVK370": "UT", // Utah
              "ChIJ_87aSGzctEwRtGtUNnSJTSY": "VT", // Vermont
              "ChIJzbK8vXDWTIgRlaZGt0lBTsA": "VA", // Virginia
              "ChIJ-bDD5__lhVQRuvNfbGh4QpQ": "WA", // Washington
              "ChIJRQnL1KVUSogRQzrN3mjHALs": "WV", // West Virginia
              "ChIJr-OEkw_0qFIR1kmG-LjV1fI": "WI", // Wisconsin
              "ChIJaS7hSDTiXocRLzh90nkisCY": "WY"  // Wyoming
            }
            
            const stateAbbr = placeIdToStateMap[placeId] || ''
          
            if (stateAbbr) {
              console.log(`🎨 正常模式样式设置 - ${stateAbbr}: ${STATE_POPULATION_DATA[stateAbbr] ? '美国州按人口着色' : '非美国地区统一着色'}`)
            }
          
          // 复用人口着色逻辑：美国州按人口，其他地区统一颜色
          const fillColor = getStatePopulationColor(stateAbbr)
          
          return {
            fillColor: fillColor,
            fillOpacity: 0.8, // 保持不透明度
            strokeColor: '#000000', // 黑色边框
            strokeWeight: 1, // 边框粗细
            strokeOpacity: 0.8 // 稍微透明的边框
          }
        }

        // 强制刷新样式以确保应用
        setTimeout(() => {
          if (featureLayer && featureLayer.style) {
            const originalStyle = featureLayer.style
            featureLayer.style = null
            setTimeout(() => {
              featureLayer.style = originalStyle

            }, 100)
          }
        }, 500)

        // 添加客户数量标签（只显示有客户的州）
        console.log('🏷️ 添加正常模式标签（只显示有客户的州）')
        await addStateLabels(stateStats)
        
        // 保存 featureLayer 引用
        statePolygonsRef.current.push(featureLayer)
        

        
      } catch (err) {
        // 降级方案：使用圆形覆盖
        createSimpleStateOverlays()
      }
    }

    // 添加州标签显示客户数量（格式: CA: 2）
    const addStateLabels = async (stateStats: Map<string, number>) => {
      try {
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker") as any

        // 计算每个州的中心位置并添加标签
        const stateCustomers = new Map<string, Customer[]>()
        customers.forEach(customer => {
          const state = customer.state?.trim()
          if (state && state.length === 2) {
            if (!stateCustomers.has(state)) {
              stateCustomers.set(state, [])
            }
            stateCustomers.get(state)!.push(customer)
          }
        })

        stateCustomers.forEach((customerList, stateAbbr) => {
          if (customerList.length === 0) return

          // 计算州的中心位置
          const centerLat = customerList.reduce((sum, c) => sum + c.lat, 0) / customerList.length
          const centerLng = customerList.reduce((sum, c) => sum + c.lng, 0) / customerList.length
          const customerCount = customerList.length

          // 创建州标签 (格式: CA: 2)
          const labelElement = document.createElement('div')
          labelElement.innerHTML = `
            <div style="
              background: rgba(255,255,255,0.95);
              border: 2px solid #333;
              border-radius: 8px;
              padding: 6px 10px;
              font-family: Arial, sans-serif;
              font-size: 14px;
              font-weight: bold;
              color: #333;
              text-align: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              white-space: nowrap;
            ">
              ${stateAbbr}: ${customerCount}
            </div>
          `

          const stateLabel = new AdvancedMarkerElement({
            position: { lat: centerLat, lng: centerLng },
            map: mapInstanceRef.current,
            content: labelElement
          })

          statePolygonsRef.current.push(stateLabel)
        })
      } catch (err) {
        // State labels creation failed silently
      }
    }

    // 降级方案：简化的州覆盖（如果新API不可用）
    const createSimpleStateOverlays = () => {
      const stateStats = getCustomersByState()
      const maxCount = Math.max(...Array.from(stateStats.values()), 1)
      
      const stateCustomers = new Map<string, Customer[]>()
      customers.forEach(customer => {
        const state = customer.state?.trim()
        if (state && state.length === 2) {
          if (!stateCustomers.has(state)) {
            stateCustomers.set(state, [])
          }
          stateCustomers.get(state)!.push(customer)
        }
      })

      stateCustomers.forEach((customers, state) => {
        if (customers.length === 0) return

        const centerLat = customers.reduce((sum, c) => sum + c.lat, 0) / customers.length
        const centerLng = customers.reduce((sum, c) => sum + c.lng, 0) / customers.length
        const customerCount = customers.length
        // 使用基于人口的颜色（而非客户数量）
        const fillColor = getStatePopulationColor(state)
        
        const stateCircle = new window.google.maps.Circle({
          center: { lat: centerLat, lng: centerLng },
          radius: Math.max(150000, customerCount * 50000), // 半径仍基于客户数量
          fillColor: fillColor,
          fillOpacity: 0.6, // 保持透明度
          strokeColor: '#000',
          strokeOpacity: 0.8,
          strokeWeight: 3, // 边框宽度
          map: mapInstanceRef.current
        })

        statePolygonsRef.current.push(stateCircle)
      })
      

    }

    // 清除州级覆盖
    const clearStateOverlays = () => {
      statePolygonsRef.current.forEach(layer => {
        if (layer.setMap) {
          // 清除标记和其他覆盖层
          layer.setMap(null)
        } else if (layer.style) {
          // 重置 FeatureLayer 样式
          layer.style = null
        }
      })
      statePolygonsRef.current = []
    }

    // 加载Google Maps API
    useEffect(() => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyBMkDXChYggBlWNUOOA7ysyf24eWRgf8sg"

      if (!apiKey) {
        setError("Google Maps API key not set")
        return
      }

      // 检查是否已经加载
      if (window.google && window.google.maps) {
        setIsLoaded(true)
        return
      }

      // 检查是否已经有脚本正在加载
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        // 如果脚本已存在，等待其加载完成
        const checkLoaded = setInterval(() => {
          if (window.google && window.google.maps) {
            setIsLoaded(true)
            clearInterval(checkLoaded)
          }
        }, 100)
        
        // 10秒后停止检查，避免无限等待
        setTimeout(() => clearInterval(checkLoaded), 10000)
        return
      }

      // 创建唯一的回调函数名
      const callbackName = `initMap_${Date.now()}`

      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`
      script.async = true
      script.defer = true

      script.onerror = () => {
        const errorMsg = "Failed to load Google Maps API script, please check if the API key is correct"
        setError(errorMsg)
      }

      // 使用唯一的回调函数名
      (window as any)[callbackName] = () => {
        setIsLoaded(true)
        // 清理回调函数
        delete (window as any)[callbackName]
      }

      document.head.appendChild(script)

      return () => {
        // 清理函数
        if ((window as any)[callbackName]) {
          delete (window as any)[callbackName]
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      }
    }, [])

    // 初始化地图
    useEffect(() => {
      if (!isLoaded || !mapRef.current || !window.google) return

      try {
        // 检查环境变量配置
        checkEnvironmentConfig()
        
        const mapStyles = [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.business",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.medical",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.school",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.government",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.place_of_worship",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.attraction",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.park",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "transit",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "transit.station",
            stylers: [{ visibility: "off" }],
          },
        ]

        // 创建地图实例
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          zoom: 5,
          center: { lat: 40.76, lng: -101.64 }, // 美国中心位置 { lat: 39.8283, lng: -98.5795 }
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          styles: mapStyles, // 应用地图样式
          // 添加 Map ID 以启用 data-driven styling
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID', // 从环境变量获取或使用默认值
        })

        // 添加缩放级别变化监听器
        mapInstanceRef.current.addListener('zoom_changed', () => {
          const newZoom = mapInstanceRef.current.getZoom()
          setCurrentZoom(newZoom)
        })

        // 创建信息窗口
        infoWindowRef.current = new window.google.maps.InfoWindow()

        // 初始化时根据缩放级别显示相应内容
        if (currentZoom < 6) {
          createStateOverlays().catch(() => {})
        } else {
          createMarkers()
        }
      } catch (err) {
        const errorMsg = `Map initialization failed: ${err}`
        setError(errorMsg)
      }
    }, [isLoaded])

    const createMarkers = () => {
      if (!mapInstanceRef.current || !window.google?.maps || !customers?.length) {
        return
      }

      // 延迟创建标记，提高性能
      requestAnimationFrame(() => {
        createMarkersInternal()
      })
    }

    const createMarkersInternal = () => {
      if (!mapInstanceRef.current || !window.google?.maps || !customers?.length) {
        return
      }

      try {
        // 清除现有标记和圆形覆盖层
        markersRef.current.forEach((marker) => marker.setMap(null))
        circlesRef.current.forEach((circle) => circle.setMap(null)) // 清除现有圆形覆盖层
        markersRef.current = []
        circlesRef.current = []

        // 根据缩放级别决定是否显示标记
        if (currentZoom < 6) {
          return
        }

        // 计算销售量数据用于标记大小
        const customerSalesMap = new Map<string, number>()
        let maxSalesAmount = 0
        
        customers.forEach(customer => {
          const amount = customer.totalAmount || 0
          if (!customerSalesMap.has(customer.customerId)) {
            customerSalesMap.set(customer.customerId, amount)
            maxSalesAmount = Math.max(maxSalesAmount, amount)
          }
        })
        

        // 创建新标记和圆形覆盖层（只在缩放级别6+时）
        customers.forEach((customer, index) => {
          const customerSales = customerSalesMap.get(customer.customerId) || 0
          const color = getColorByAmount(customerSales)
          const markerRadius = getMarkerSizeByAmount(customerSales, maxSalesAmount)
          const isSelected = selectedCustomer?.id === customer.id
          
          const markerSize = markerRadius * 2 + 8
          const markerIcon = isSelected 
            ? createSalesBasedMarker("#ef4444", markerRadius, true)
            : createSalesBasedMarker(color, markerRadius, false)


          const marker = new window.google.maps.Marker({
            position: { lat: customer.lat, lng: customer.lng },
            map: mapInstanceRef.current,
            title: `${customer.companyName} (Sales: ${customerSales.toLocaleString()})`,
            icon: {
              url: markerIcon,
              scaledSize: new window.google.maps.Size(markerSize, markerSize),
              anchor: new window.google.maps.Point(markerSize/2, markerSize/2),
            },
          })

          if (customer.salesRadius) {
            const circle = new window.google.maps.Circle({
              strokeColor: color,
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: color,
              fillOpacity: 0.15,
              map: showSalesRange ? mapInstanceRef.current : null,
              center: { lat: customer.lat, lng: customer.lng },
              radius: customer.salesRadius * 1000, // 转换为米
            })
            circlesRef.current.push(circle)
          }

          // 添加点击事件
          marker.addListener("click", () => {
            onCustomerSelect(customer)

            // 显示信息窗口
            const content = `
            <div class="p-3 min-w-[250px]">
              <h3 class="font-semibold text-lg mb-2">${customer.companyName}</h3>
              <p class="text-sm mb-1"><strong>Email:</strong> ${customer.email}</p>
              <p class="text-sm mb-1"><strong>Phone:</strong> ${customer.phone}</p>
              <p class="text-sm mb-2"><strong>Address:</strong> ${customer.address}</p>
              ${customer.salesRadius ? `<p class="text-sm mb-2"><strong>Sales Range:</strong> ${customer.salesRadius}km</p>` : ""}
              <div class="flex flex-wrap gap-1">
                ${customer.tags.map((tag) => `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">${tag}</span>`).join("")}
              </div>
            </div>
          `

            infoWindowRef.current.setContent(content)
            infoWindowRef.current.open(mapInstanceRef.current, marker)
          })

          markersRef.current.push(marker)
        })

        // 注释掉自动调整缩放逻辑，保持用户设置的缩放级别
        // 用户可以通过"重置视图"按钮来查看所有标记
        // if (customers.length > 0) {
        //   const bounds = new window.google.maps.LatLngBounds()
        //   customers.forEach((customer) => {
        //     bounds.extend({ lat: customer.lat, lng: customer.lng })
        //   })
        //   mapInstanceRef.current.fitBounds(bounds)
        //
        //   // 如果只有一个标记，设置合适的缩放级别
        //   if (customers.length === 1) {
        //     mapInstanceRef.current.setZoom(15)
        //   }
        // }

      } catch (err) {
        const errorMsg = `Marker creation failed: ${err}`
        setError(errorMsg)
      }
    }

    useEffect(() => {
      circlesRef.current.forEach((circle) => {
        circle.setMap(showSalesRange ? mapInstanceRef.current : null)
      })
    }, [showSalesRange])

    // 监听缩放级别变化，控制显示内容
    useEffect(() => {
      if (!mapInstanceRef.current) return
      
      if (currentZoom < 6) {
        // 缩放级别小于6，显示州级覆盖，隐藏标记
        createStateOverlays().catch(() => {})
        // 清除标记但保留在引用中，以便快速恢复
        markersRef.current.forEach((marker) => marker.setMap(null))
        circlesRef.current.forEach((circle) => circle.setMap(null))

      } else {
        // 缩放级别大于等于6，隐藏州级覆盖，显示标记
        clearStateOverlays()
        createMarkers()

      }
    }, [currentZoom, customers])

    useEffect(() => {
      if (currentZoom >= 6) {
      createMarkers()
      }
    }, [customers, selectedCustomer, onCustomerSelect, currentZoom])

    // 当选中客户改变时，移动地图中心
    useEffect(() => {
      if (!selectedCustomer || !mapInstanceRef.current) return

      mapInstanceRef.current.panTo({ lat: selectedCustomer.lat, lng: selectedCustomer.lng })
      mapInstanceRef.current.setZoom(15)
    }, [selectedCustomer])

    const resetView = () => {
      if (!mapInstanceRef.current || !window.google) return

      // 重置到固定的缩放级别和中心位置
      mapInstanceRef.current.setCenter({ lat: 39.8283, lng: -98.5795 }) // 美国中心位置
      mapInstanceRef.current.setZoom(5) // 固定缩放级别5

      // 关闭信息窗口
      if (infoWindowRef.current) {
        infoWindowRef.current.close()
      }


    }

    useImperativeHandle(ref, () => ({
      resetView,
    }))

    const actualApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyBMkDXChYggBlWNUOOA7ysyf24eWRgf8sg"

    if (!actualApiKey) {
      return (
        <div className="h-full flex items-center justify-center bg-muted">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Please set Google Maps API key</p>
            <p className="text-sm text-muted-foreground">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to environment variables</p>
            <p className="text-xs text-red-500 mt-2">Make sure to use NEXT_PUBLIC_ prefix</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="h-full flex items-center justify-center bg-muted">
          <div className="text-center max-w-md">
            <p className="text-red-500 mb-2">Map loading error</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <p className="text-xs text-muted-foreground">
              Please check: 1. API key is correct 2. Maps JavaScript API is enabled 3. Domain is in API restrictions
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full w-full relative">
        <div ref={mapRef} className="h-full w-full" />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        {/* Boot Camp兼容性提示 */}
        {isLoaded && usePolygonFallback && (
          <div className="absolute bottom-4 left-4 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-md shadow-sm">
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
              <span className="text-yellow-800">Boot Camp兼容模式</span>
            </div>
          </div>
        )}
      </div>
    )
  },
)

GoogleMap.displayName = "GoogleMap"
