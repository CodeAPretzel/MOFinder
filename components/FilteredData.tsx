import { useMemo } from 'react';

const FilteredData = (data: MofEntry[], filters: FilterState) => {
  return useMemo(() => {
    return data.filter((item) => {
      // Text Search
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = item.mof_name.toLowerCase().includes(query);
        const matchesLinker =
          item.linker_1.toLowerCase().includes(query) ||
          item.linker_1_abbr.toLowerCase().includes(query);
        const matchesMetal =
          item.metal_1.toLowerCase().includes(query) ||
          item.metal_1_abbr.toLowerCase().includes(query);

        if (!matchesName && !matchesLinker && !matchesMetal) return false;
      }

      // Numeric Filters
      if (item.bet_surface_area_m2g < filters.minSurfaceArea) return false;
      if (item.pore_diameter_A < filters.minPoreDiameter) return false;
      if (item.temperature_c > filters.maxTemperature) return false;
      if (item.time_h > filters.maxTime) return false;
      if (item.tga_decomposition_temp_c < filters.minTgaTemp) return false;

      // Boolean Toggles
      if (filters.waterStable && !item.water_stable) return false;
      if (filters.airStable && !item.air_stable) return false;

      // Dropdowns
      if (filters.topology && item.topology_code !== filters.topology) return false;
      if (filters.metal && item.metal_1_abbr !== filters.metal) return false;

      return true;
    });
  }, [data, filters]);
}

export default FilteredData