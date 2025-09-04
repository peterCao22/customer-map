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




    // 创建州级覆盖层（正常模式 - 使用FeatureLayer）
    const createStateOverlays = () => {
      if (!mapInstanceRef.current || !window.google?.maps?.FeatureLayer) return
      
      clearStateOverlays()
      
      // 使用Google Maps的FeatureLayer显示美国州级边界
      const featureLayer = new window.google.maps.FeatureLayer({
        featureType: window.google.maps.FeatureType.ADMINISTRATIVE_AREA_LEVEL_1
      })
      
      // 州边界样式设置
      featureLayer.style = (params: any) => {
        const feature = params.feature
            const placeId = feature.placeId
            
        // Place ID到州代码的映射表
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
          
        // 复用人口着色逻辑：美国州按人口，其他地区统一颜色
          const fillColor = getStatePopulationColor(stateAbbr)
          
          return {
          strokeColor: '#000000',
          strokeOpacity: 0.8,
          strokeWeight: 1,
            fillColor: fillColor,
          fillOpacity: 0.5
        }
      }
      
      featureLayer.setMap(mapInstanceRef.current)
        statePolygonsRef.current.push(featureLayer)
        
      // 添加点击事件监听器
      featureLayer.addListener('click', (event: any) => {
        const feature = event.features[0]
        const placeId = feature.placeId
        const displayName = feature.displayName
        
        // 从Place ID获取州代码
        const placeIdToStateMap: { [placeId: string]: string } = {
          "ChIJdf5LHzR_hogR6czIUzU0VV4": "AL", "ChIJG8CuwJzfAFQRNduKqSde27w": "AK", 
          "ChIJaxhMy-sIK4cRcc3Bf7EnOUI": "AZ", "ChIJYSc_dD-e0ocR0NLf_z5pBaQ": "AR",
          "ChIJPV4oX_65j4ARVW8IJ6IJUYs": "CA", "ChIJt1YYm3QUQIcR_6eQSTGDVMc": "CO",
          "ChIJpVER8hFT5okR5XBhBVttmq4": "CT", "ChIJO9YMTXYFx4kReOgEjBItHZQ": "DE",
          "ChIJvypWkWV2wYgR0E7HW9MTLvc": "FL", "ChIJV4FfHcU28YgR5xBP7BC8hGY": "GA",
          "ChIJCdwf1zayuokR8TxHz_n_oiM": "HI", "ChIJJQXaM4w1VYcRjT9emnqCGFo": "ID",
          "ChIJGSZubzgtC4gRVlkRZFCCFX8": "IL", "ChIJHRv42bxQa4gRcuwyy84vEH4": "IN",
          "ChIJGWD48W9e7ocR2VnHV0pj78Y": "IA", "ChIJawF8cXEXo4cRXwk-S6m0wmg": "KS",
          "ChIJyVMZi0xzQogR_N_MxU5vH3c": "KY", "ChIJZYIRslSkIIYRA0flgTL3Vck": "LA",
          "ChIJ1YpTHd4dsEwR0KggZ2_MedY": "ME", "ChIJ35Dx6etNtokRsfZVdmU3r_I": "MD",
          "ChIJ_b9z6W1l44kRHA2DVTbQxkU": "MA", "ChIJEQTKxz2qTE0Rs8liellI3Zc": "MI",
          "ChIJmwt4YJpbWE0RD6L-EJvJogI": "MN", "ChIJGdRK5OQyKIYR2qbc6X8XDWI": "MS",
          "ChIJfeMiSNXmwIcRcr1mBFnEW7U": "MO", "ChIJ04p7LZwrQVMRGGwqz1jWcfU": "MT",
          "ChIJ7fwMtciNk4cRxArzDwyQJ6E": "NE", "ChIJcbTe-KEKmYARs5X8qooDR88": "NV",
          "ChIJ66bAnUtEs0wR64CmJa8CyNc": "NH", "ChIJn0AAnpX7wIkRjW0_-Ad70iw": "NJ",
          "ChIJqVKY50NQGIcRup41Yxpuv0Y": "NM", "ChIJqaUj8fBLzEwRZ5UY3sHGz90": "NY",
          "ChIJgRo4_MQfVIgRGa4i6fUwP60": "NC", "ChIJY-nYVxKD11IRyc9egzmahA0": "ND",
          "ChIJwY5NtXrpNogRFtmfnDlkzeU": "OH", "ChIJnU-ssRE5rIcRSOoKQDPPHF0": "OK",
          "ChIJVWqfm3xuk1QRdrgLettlTH0": "OR", "ChIJieUyHiaALYgRPbQiUEchRsI": "PA",
          "ChIJD9cOYhQ15IkR5wbB57wYTh4": "RI", "ChIJ49ExeWml-IgRnhcF9TKh_7k": "SC",
          "ChIJpTjphS1DfYcRt6SGMSnW8Ac": "SD", "ChIJA8-XniNLYYgRVpGBpcEgPgM": "TN",
          "ChIJSTKCCzZwQIYRPN4IGI8c6xY": "TX", "ChIJzfkTj8drTIcRP0bXbKVK370": "UT",
          "ChIJ_87aSGzctEwRtGtUNnSJTSY": "VT", "ChIJzbK8vXDWTIgRlaZGt0lBTsA": "VA",
          "ChIJ-bDD5__lhVQRuvNfbGh4QpQ": "WA", "ChIJRQnL1KVUSogRQzrN3mjHALs": "WV",
          "ChIJr-OEkw_0qFIR1kmG-LjV1fI": "WI", "ChIJaS7hSDTiXocRLzh90nkisCY": "WY"
        }
        
        const stateAbbr = placeIdToStateMap[placeId] || ''
        const stateStats = getCustomersByState()
        const customerCount = stateStats.get(stateAbbr) || 0
        const population = STATE_POPULATION_DATA[stateAbbr] || 0
        
        let infoContent = ''
        
        if (STATE_POPULATION_DATA[stateAbbr]) {
          // 美国州：显示人口和客户信息
          infoContent = `
            <div style="padding: 8px; font-family: system-ui;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937;">${displayName}</h3>
              <p style="margin: 0; color: #4b5563;">Population: ${population.toLocaleString()}</p>
              <p style="margin: 4px 0 0 0; color: #6b7280;">Customers: ${customerCount}</p>
            </div>
          `
        } else {
          // 非美国地区：只显示客户信息
          infoContent = `
            <div style="padding: 8px; font-family: system-ui;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937;">${displayName}</h3>
              <p style="margin: 0; color: #6b7280;">Customers: ${customerCount}</p>
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
          createStateOverlays()
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
        createStateOverlays()
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
      </div>
    )
  },
)

GoogleMap.displayName = "GoogleMap"
